import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { IfcRepository } from '../core/ifcs.repository';
import { IfcValidation, IfcTransitionContext } from '../core/ifcs.validation';

import { IfcStatusReportDto, ListIfcsDto, RejectIfcDto, UpdateIfcDto } from '../model/ifcs.dtos';
import { CreateIfcDto, IfcContentDto, IfcPrefillQueryDto } from '../model/ifcs-content.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';
import { I18nText } from 'src/shared/types/i18n';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IFCS_PARAMETER_KEYS, IFC_INSTRUMENT_CODE, IFC_OPS, IfcOp } from './ifcs.constants';
import { PDF_LABELS, PdfRendererService, PDF_STYLES, UPC_LOGO_DATA_URI } from './pdf-renderer.service';
import * as ExcelJS from 'exceljs';
import { NotificationDispatcherService, DispatchResult } from 'src/modules/ifc/notifications/notification-dispatcher.service';

interface StatusReportRow {
	course_name: string;
	area_label: string;
	program_label: string;
	coordinator_name: string | null;
	coordinator_email: string | null;
	coordinator_code: string | null;
	status_code: string | null;
}

@Injectable()
export class IfcService extends BaseService<IfcRepository> {
	constructor(
		protected readonly repository: IfcRepository,
		protected readonly dataSource: DataSource,
		private readonly pdfRenderer: PdfRendererService,
		private readonly dispatcher: NotificationDispatcherService,
	) {
		super(repository);
	}

	async resolveCurrentStatusCode(chartId: number, periodId: number): Promise<string> {
		const rows = await this.dataSource.query(
			`
			SELECT COALESCE(
				(SELECT t.code FROM ifc.statuses s
				   JOIN core.types t ON t.id = s.status_type_id
				   JOIN evidence.ifcs i ON i.id = s.ifc_id
				   JOIN organization.charts c ON c.entity_code = i.course_id AND c.academic_period_id = i.academic_period_id
				   WHERE c.id = $1 AND i.academic_period_id = $2
				   ORDER BY s.register_at DESC LIMIT 1),
				$3
			) AS code
			`,
			[chartId, periodId, TYPE_CODES.IFC_STATUS.UNREGISTERED],
		);
		return rows[0]?.code ?? TYPE_CODES.IFC_STATUS.UNREGISTERED;
	}

	async notify(chartId: number, periodId: number, userId: number): Promise<DispatchResult> {
		const statusCode = await this.resolveCurrentStatusCode(chartId, periodId);
		return await this.dispatcher.dispatch({
			chartId,
			periodId,
			triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.MANUAL,
			ifcStatusCode: statusCode,
			notifierUserId: userId,
		});
	}

	async notifyAll(chartIds: number[], periodId: number, userId: number) {
		const sent: number[] = [];
		const skipped: number[] = [];
		const errors: Array<{ chart_id: number; message: string }> = [];

		for (const chartId of chartIds) {
			try {
				const statusCode = await this.resolveCurrentStatusCode(chartId, periodId);
				const result = await this.dispatcher.dispatch({
					chartId,
					periodId,
					triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.MANUAL,
					ifcStatusCode: statusCode,
					notifierUserId: userId,
				});
				if (result.sent) sent.push(chartId);
				else skipped.push(chartId);
			} catch (e) {
				errors.push({ chart_id: chartId, message: (e as Error).message });
			}
		}
		return { sent, skipped, errors };
	}

	async generatePdf(ifcId: number, userId: number, schoolId: number, lang: 'es' | 'en') {
		const data = await this.getView(ifcId, userId, schoolId);

		if (data.ifc.status?.code !== TYPE_CODES.IFC_STATUS.APPROVED) {
			throw new HttpException({ message: ifcsValidationStrings.result.pdfFailed, errors: [ifcsValidationStrings.error.pdfRequiresApproved] }, HttpStatus.CONFLICT);
		}

		const html = this.buildIfcHtml(data, lang);
		const pdf = await this.pdfRenderer.htmlToPdf(html);
		const filename = this.buildPdfFilename(data, lang);
		return { pdf, filename };
	}

	async generateStatusReport(dto: IfcStatusReportDto, schoolId: number) {
		const codeRow = await this.dataSource.query(REPORT_CODES_SQL, [dto.chart_ids, schoolId, TYPE_CODES.ENTITY_TYPE.SCHOOL]);
		const schoolCode: string = codeRow[0]?.school_code ?? 'IFC';
		const programCodes: string[] = codeRow[0]?.program_codes ?? [];
		const suffix = programCodes.length === 1 ? `${schoolCode}_${programCodes[0]}` : schoolCode;

		const statusTypes: Array<{ code: string; name: { es?: string; en?: string } }> = await this.dataSource.query(
			`SELECT t.code, t.name FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id WHERE g.code = $1`,
			[TYPE_GROUP_CODES.IFC_STATUS],
		);
		const statusLabelByCode: Record<string, string> = Object.fromEntries(statusTypes.map((s) => [s.code, s.name?.[dto.lang] ?? s.name?.es ?? s.code]));

		const rows: StatusReportRow[] = await this.dataSource.query(STATUS_REPORT_SQL, [
			dto.chart_ids,
			dto.period_id,
			schoolId,
			TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			dto.lang,
		]);

		const xlsx = await this.buildStatusReportXlsx(rows, statusLabelByCode, dto.lang);
		const filename = (dto.lang === 'en' ? 'Status_Report_IFC_' : 'Reporte_Estado_IFC_') + suffix + '.xlsx';
		return { xlsx, filename };
	}

	private async buildStatusReportXlsx(rows: StatusReportRow[], statusLabelByCode: Record<string, string>, lang: 'es' | 'en'): Promise<Buffer> {
		const wb = new ExcelJS.Workbook();
		wb.creator = 'ABET system';
		wb.created = new Date();

		const ws = wb.addWorksheet(lang === 'en' ? 'Status Report' : 'Reporte de Estado');

		const HEADERS = lang === 'en' ? ['Course', 'Area', 'Program', 'Status', 'Professor', 'Professor Code', 'Email'] : ['Curso', 'Área', 'Carrera', 'Estado', 'Docente', 'Código Docente', 'Correo'];

		ws.columns = HEADERS.map((h) => ({ header: h, width: 28 }));

		const headerRow = ws.getRow(1);
		headerRow.height = 22;
		headerRow.eachCell((cell) => {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } };
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
		});

		for (const r of rows) {
			const statusCode = r.status_code ?? TYPE_CODES.IFC_STATUS.UNREGISTERED;
			ws.addRow([r.course_name, r.area_label, r.program_label, statusLabelByCode[statusCode] ?? statusCode, r.coordinator_name ?? '—', r.coordinator_code ?? '—', r.coordinator_email ?? '—']);
		}

		ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			if (rowNumber === 1) return;
			row.eachCell((cell) => {
				cell.border = {
					top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
					left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
					right: { style: 'thin', color: { argb: 'FFD4D4D8' } },
					bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
				};
				cell.alignment = { vertical: 'top', wrapText: true };
			});
		});

		ws.views = [{ state: 'frozen', ySplit: 1 }];

		return Buffer.from(await wb.xlsx.writeBuffer());
	}

	async generatePdfBulk(ifcIds: number[], userId: number, schoolId: number, lang: 'es' | 'en') {
		// Open: each new Chromium page costs memory; ArrayMaxSize(50) caps worst case.
		// If load grows, gate with p-limit(3) — see spec §5.3.
		const payloads = await Promise.all(ifcIds.map((id) => this.getView(id, userId, schoolId)));
		const nonApproved = payloads.find((p) => p.ifc.status?.code !== TYPE_CODES.IFC_STATUS.APPROVED);
		if (nonApproved) {
			throw new HttpException({ message: ifcsValidationStrings.result.pdfBulkFailed, errors: [ifcsValidationStrings.error.pdfRequiresApproved] }, HttpStatus.CONFLICT);
		}

		const files = await Promise.all(
			payloads.map(async (data) => ({
				filename: this.buildPdfFilename(data, lang),
				pdf: await this.pdfRenderer.htmlToPdf(this.buildIfcHtml(data, lang)),
			})),
		);

		const zip = await this.pdfRenderer.filesToZip(files);
		const filename = `ZIP_IFC_${lang.toUpperCase()}.zip`;
		return { zip, filename };
	}

	private buildPdfFilename(data: any, lang: 'es' | 'en'): string {
		const ifc = data.ifc;
		const courseCode = ifc.course_code ?? '';
		const courseName = (ifc.course_name?.[lang] ?? ifc.course_name?.es ?? '').replace(/\s+/g, '_');
		const period = ifc.academic_period_code ?? '';
		const profCode = ifc.coordinator?.code ?? '';
		return `IFC_${courseCode}_${courseName}_${period}_${profCode}.pdf`;
	}

	private buildIfcHtml(data: any, lang: 'es' | 'en'): string {
		const L = PDF_LABELS[lang];
		const ifc = data.ifc;

		const outcomeBullets =
			data.outcome_course_result
				.flatMap((p: any) =>
					p.commissions.flatMap((c: any) =>
						c.outcomes.map(
							(o: any) => `
							<li><strong>Student Outcome</strong>
								(${esc(p.program_name?.[lang])} - ${esc(c.commission_name?.[lang])} - ${esc(o.outcome_name?.[lang])})
								"${esc(o.outcome_description?.[lang])}"
							</li>`,
						),
					),
				)
				.join('') || `<li class="empty">—</li>`;

		const findingRows = data.findings.map((f: any) => `<tr><td>${esc(f.code)}</td><td>${esc(f.description?.[lang])}</td></tr>`).join('') || `<tr><td colspan="2" class="empty">—</td></tr>`;

		const actionRows =
			data.findings.flatMap((f: any) => f.actions.map((a: any) => `<tr><td>${esc(a.code)}</td><td>${esc(a.description?.[lang])}</td><td>${esc(f.code)}</td></tr>`)).join('') ||
			`<tr><td colspan="3" class="empty">—</td></tr>`;

		const logoTag = UPC_LOGO_DATA_URI ? `<img class="logo" src="${UPC_LOGO_DATA_URI}" alt="UPC" />` : '';

		return `
			<!doctype html>
			<html lang="${lang}">
			<head>
				<meta charset="utf-8" />
				<title>${esc(L.report_title)}</title>
				<style>${PDF_STYLES}</style>
			</head>
			<body>
				<header>
					${logoTag}
					<h1 class="title">${esc(L.university)}</h1>
					<h2 class="subtitle">${esc(ifc.program_label?.[lang] ?? '')}</h2>
					<hr class="rule" />
					<h2 class="report-title">${esc(L.report_title)}</h2>
					<p><strong>${esc(L.semester)}:</strong> ${esc(ifc.academic_period_code)}</p>
					<p><strong>${esc(L.course)}:</strong> ${esc(ifc.course_code ?? '')} - ${esc(ifc.course_name?.[lang])}</p>
					<p><strong>${esc(L.coordinator)}:</strong> ${esc(ifc.coordinator?.name ?? '')}</p>
				</header>

				<hr class="rule" />

				<section>
					<h3>${esc(L.s1_title)}</h3>
					<ul>${outcomeBullets}</ul>
					<h4>${esc(L.s11_title)}</h4>
					<p>${esc(ifc.course_learning_outcome?.[lang]) || '-'}</p>
				</section>

				<hr class="rule" />

				<section>
					<h3>${esc(L.s2_title)}</h3>
					<table>
						<thead><tr><th>${esc(L.s2_col_code)}</th><th>${esc(L.s2_col_desc)}</th><th>${esc(L.s2_col_state)}</th></tr></thead>
						<tbody><tr><td colspan="3" class="empty">${esc(L.s2_empty)}</td></tr></tbody>
					</table>
				</section>

				<hr class="rule" />

				<section>
					<h3>${esc(L.s3_title)}</h3>
					<table>
						<thead><tr><th>${esc(L.s3_col_code)}</th><th>${esc(L.s3_col_desc)}</th></tr></thead>
						<tbody>${findingRows}</tbody>
					</table>
				</section>

				<hr class="rule" />

				<section>
					<h3>${esc(L.s4_title)}</h3>
					<table>
						<thead><tr><th>${esc(L.s4_col_code)}</th><th>${esc(L.s4_col_desc)}</th><th>${esc(L.s4_col_finding)}</th></tr></thead>
						<tbody>${actionRows}</tbody>
					</table>
				</section>
			</body>
			</html>
		`;
	}

	async update(id: number, dto: UpdateIfcDto, manager?: EntityManager) {
		await IfcValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await IfcValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async list(dto: ListIfcsDto) {
		return await this.dataSource.query(LIST_SQL, [dto.chart_ids, dto.period_id, TYPE_CODES.ENTITY_TYPE.COURSE]);
	}

	async getView(id: number, userId: number, schoolId: number) {
		const [headerRows, findingRows, outcomeCourseRows] = await Promise.all([
			this.dataSource.query(HEADER_SQL, [id, schoolId, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR, TYPE_CODES.ENTITY_TYPE.SCHOOL, userId]),
			this.dataSource.query(FINDINGS_SQL, [id, IFCS_PARAMETER_KEYS.FINDING_PREFIX]),
			this.dataSource.query(OUTCOME_COURSE_BY_IFC_SQL, [id]),
		]);

		if (headerRows.length === 0) {
			throw new HttpException({ message: ifcsValidationStrings.result.viewFailed, errors: [ifcsValidationStrings.error.notFound] }, HttpStatus.NOT_FOUND);
		}

		const findingIds = findingRows.map((r: any) => Number(r.finding_id));
		const [findingOutcomeRows, findingActionRows] = await Promise.all([
			findingIds.length ? this.dataSource.query(FINDING_OUTCOMES_SQL, [findingIds]) : Promise.resolve([]),
			findingIds.length
				? this.dataSource.query(FINDING_ACTIONS_SQL, [findingIds, IFCS_PARAMETER_KEYS.ACTION_PREFIX, TYPE_CODES.ACTION_COMPLETENESS.PENDING, TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED])
				: Promise.resolve([]),
		]);

		return this.assembleViewResponse({
			header: headerRows[0],
			findingRows,
			outcomeCourseRows,
			findingOutcomeRows,
			findingActionRows,
		});
	}

	async submit(ifcId: number, userId: number, schoolId: number) {
		const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, IFC_OPS.SUBMIT);
		await IfcValidation.assertIsInCourseChain(this.dataSource, ctx, IFC_OPS.SUBMIT);
		IfcValidation.assertCurrentStatus(ctx.currentStatusCode, [null, TYPE_CODES.IFC_STATUS.SAVED], IFC_OPS.SUBMIT);
		await this.insertStatus(undefined, ctx.ifcId, ctx.requesterStaffId, TYPE_CODES.IFC_STATUS.SUBMITTED, null);

		const periodRows = await this.dataSource.query(`SELECT academic_period_id FROM evidence.ifcs WHERE id = $1 LIMIT 1`, [ifcId]);
		const periodId = Number(periodRows[0]?.academic_period_id);
		const notification: DispatchResult =
			ctx.courseChartId !== null && Number.isFinite(periodId)
				? await this.dispatcher.dispatch({
						chartId: ctx.courseChartId,
						periodId,
						triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.AUTO_STATUS_CHANGE,
						ifcStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED,
						notifierUserId: userId,
					})
				: { sent: false, recipients_count: 0, cc_count: 0, reason: 'no_course_chart' };

		return { id: ifcId, notification };
	}

	async approve(ifcId: number, userId: number, schoolId: number) {
		const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, IFC_OPS.APPROVE);
		IfcValidation.assertNotOwnCoordinator(ctx, IFC_OPS.APPROVE);
		IfcValidation.assertCurrentStatus(ctx.currentStatusCode, [TYPE_CODES.IFC_STATUS.SUBMITTED], IFC_OPS.APPROVE);
		return await this.insertStatus(undefined, ctx.ifcId, ctx.requesterStaffId, TYPE_CODES.IFC_STATUS.APPROVED, null);
	}

	async reject(ifcId: number, userId: number, schoolId: number, dto: RejectIfcDto) {
		const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, IFC_OPS.REJECT);
		IfcValidation.assertNotOwnCoordinator(ctx, IFC_OPS.REJECT);
		IfcValidation.assertCurrentStatus(ctx.currentStatusCode, [TYPE_CODES.IFC_STATUS.SUBMITTED], IFC_OPS.REJECT);
		return await this.insertStatus(undefined, ctx.ifcId, ctx.requesterStaffId, TYPE_CODES.IFC_STATUS.OBSERVED, dto.comment);
	}

	async prefill(query: IfcPrefillQueryDto, schoolId: number) {
		const [headerRows, outcomeRows] = await Promise.all([
			this.dataSource.query(PREFILL_HEADER_SQL, [query.chart_id, query.period_id, schoolId, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR, TYPE_CODES.ENTITY_TYPE.SCHOOL]),
			this.dataSource.query(OUTCOME_COURSE_BY_CHART_SQL, [query.chart_id]),
		]);

		IfcValidation.assertChartFound(headerRows, 'prefill');

		return {
			...headerRows[0],
			coordinator_user_id: headerRows[0].coordinator_user_id === null ? null : Number(headerRows[0].coordinator_user_id),
			outcome_course_result: this.groupOutcomeRows(outcomeRows),
		};
	}

	async createIfc(dto: CreateIfcDto, userId: number, schoolId: number) {
		const op: IfcOp = dto.submit ? IFC_OPS.SUBMIT : IFC_OPS.CREATE;
		const { id: ifcId } = await this.dataSource.transaction(async (em) => {
			const chartRows = await em.query(CHART_RESOLUTION_SQL, [dto.chart_id, dto.period_id, schoolId, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR, TYPE_CODES.ENTITY_TYPE.SCHOOL, userId]);
			IfcValidation.assertChartFound(chartRows, op);

			const row = chartRows[0];
			const courseId = Number(row.course_id);
			const ifcCourseStaffId = row.ifc_course_staff_id === null ? null : Number(row.ifc_course_staff_id);
			const requesterStaffId = row.requester_staff_id === null ? null : Number(row.requester_staff_id);
			const programId = row.program_id === null ? null : Number(row.program_id);

			IfcValidation.assertRequesterIsStaff(requesterStaffId, op);
			await IfcValidation.assertIsInCourseChain(em, { ifcId: 0, ifcCourseStaffId, courseChartId: dto.chart_id, requesterStaffId, currentStatusCode: null }, op);

			await IfcValidation.assertNoIfcExists(em, courseId, dto.period_id, op);

			const ifcInsert = await em.query(`INSERT INTO evidence.ifcs (course_id, academic_period_id, information, extra, is_active) VALUES ($1, $2, $3::jsonb, '{}'::jsonb, true) RETURNING id`, [
				courseId,
				dto.period_id,
				JSON.stringify(dto.information ?? {}),
			]);
			const ifcId = Number(ifcInsert[0].id);

			await this.resolveFindingsAndActions(em, {
				ifcId,
				courseId,
				periodId: dto.period_id,
				programId,
				requesterStaffId: requesterStaffId!,
				op,
				findings: dto.findings,
				actions: dto.actions,
				deletedFindingIds: dto.deleted_finding_ids,
				deletedActionIds: dto.deleted_action_ids,
			});

			const newStatusCode = dto.submit ? TYPE_CODES.IFC_STATUS.SUBMITTED : TYPE_CODES.IFC_STATUS.SAVED;
			await this.insertStatus(em, ifcId, requesterStaffId!, newStatusCode, null);

			return { id: ifcId };
		});

		if (!dto.submit) return { id: ifcId };

		const notification: DispatchResult =
			Number.isFinite(dto.chart_id) && Number.isFinite(dto.period_id)
				? await this.dispatcher.dispatch({
						chartId: dto.chart_id,
						periodId: dto.period_id,
						triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.AUTO_STATUS_CHANGE,
						ifcStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED,
						notifierUserId: userId,
					})
				: { sent: false, recipients_count: 0, cc_count: 0, reason: 'no_course_chart' };

		return { id: ifcId, notification };
	}

	async patch(id: number, dto: IfcContentDto, userId: number, schoolId: number) {
		const op: IfcOp = dto.submit ? IFC_OPS.SUBMIT : IFC_OPS.PATCH;
		const { courseChartId, periodId } = await this.dataSource.transaction(async (em) => {
			const ctx = await this.loadTransitionContext(id, userId, schoolId, op, em);
			await IfcValidation.assertIsInCourseChain(em, ctx, op);
			IfcValidation.assertCurrentStatusEditable(ctx.currentStatusCode, op);

			const ifcRows = await em.query(`SELECT course_id, academic_period_id FROM evidence.ifcs WHERE id = $1`, [id]);
			const courseId = Number(ifcRows[0].course_id);
			const periodId = Number(ifcRows[0].academic_period_id);

			const programRows = await em.query(PROGRAM_BY_COURSE_PERIOD_SQL, [courseId, periodId, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR]);
			const programId = programRows[0]?.program_id === undefined || programRows[0]?.program_id === null ? null : Number(programRows[0].program_id);

			await em.query(`UPDATE evidence.ifcs SET information = $1::jsonb, updated_at = NOW() WHERE id = $2`, [JSON.stringify(dto.information ?? {}), id]);

			await this.resolveFindingsAndActions(em, {
				ifcId: id,
				courseId,
				periodId,
				programId,
				requesterStaffId: ctx.requesterStaffId!,
				op,
				findings: dto.findings,
				actions: dto.actions,
				deletedFindingIds: dto.deleted_finding_ids,
				deletedActionIds: dto.deleted_action_ids,
			});

			const newStatusCode = dto.submit ? TYPE_CODES.IFC_STATUS.SUBMITTED : TYPE_CODES.IFC_STATUS.SAVED;
			await this.insertStatus(em, id, ctx.requesterStaffId!, newStatusCode, null);

			return { courseChartId: ctx.courseChartId, periodId };
		});

		if (!dto.submit) return { id };

		const notification: DispatchResult =
			courseChartId !== null && Number.isFinite(periodId)
				? await this.dispatcher.dispatch({
						chartId: courseChartId,
						periodId,
						triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.AUTO_STATUS_CHANGE,
						ifcStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED,
						notifierUserId: userId,
					})
				: { sent: false, recipients_count: 0, cc_count: 0, reason: 'no_course_chart' };

		return { id, notification };
	}

	private async resolveFindingsAndActions(
		em: EntityManager,
		input: {
			ifcId: number;
			courseId: number;
			periodId: number;
			programId: number | null;
			requesterStaffId: number;
			op: IfcOp;
			findings: { tempId: string; id: number | null; description: I18nText; criticality_code: string }[];
			actions: { tempId: string; id: number | null; description: I18nText; finding_temp_id: string }[];
			deletedFindingIds?: number[];
			deletedActionIds?: number[];
		},
	) {
		// 1. Deletes (orphans first)
		for (const actionId of input.deletedActionIds ?? []) {
			await em.query(`DELETE FROM improvement.finding_actions WHERE action_id = $1`, [actionId]);
			await em.query(`DELETE FROM improvement.actions WHERE id = $1`, [actionId]);
		}
		for (const findingId of input.deletedFindingIds ?? []) {
			await em.query(`DELETE FROM improvement.finding_outcomes WHERE finding_id = $1`, [findingId]);
			await em.query(`DELETE FROM improvement.finding_actions WHERE finding_id = $1`, [findingId]);
			await em.query(`DELETE FROM ifc.ifc_findings WHERE finding_id = $1`, [findingId]);
			await em.query(`DELETE FROM improvement.findings WHERE id = $1`, [findingId]);
		}

		// 2. Resolve the IFC instrument id ONCE — every finding raised from this form uses it.
		const instrumentRows = await em.query(`SELECT id::int AS id FROM evidence.instruments WHERE code = $1 AND is_active = true LIMIT 1`, [IFC_INSTRUMENT_CODE]);
		const ifcInstrumentId: number | undefined = instrumentRows[0]?.id;
		if (!ifcInstrumentId) {
			throw new HttpException({ message: ifcsValidationStrings.result[`${input.op}Failed`], errors: [ifcsValidationStrings.error.ifcInstrumentMissing] }, HttpStatus.INTERNAL_SERVER_ERROR);
		}

		// 3. Resolve criticality codes → type ids in one shot
		const criticalityCodes = Array.from(new Set(input.findings.map((f) => f.criticality_code)));
		const criticalityRows = criticalityCodes.length ? await em.query(`SELECT id::int AS id, code FROM core.types WHERE code = ANY($1::text[])`, [criticalityCodes]) : [];
		const criticalityByCode = new Map<string, number>(criticalityRows.map((r: any) => [r.code, Number(r.id)]));

		// 4. Findings upsert — single correlative base for (ifcInstrumentId, courseId)
		const hasNewFinding = input.findings.some((f) => f.id === null);
		let nextFindingCorrelative = 0;
		if (hasNewFinding) {
			const base = await em.query(
				`SELECT COALESCE(MAX(correlative), 0)::int AS c
				 FROM improvement.findings
				 WHERE instrument_id = $1
				   AND ((course_id IS NULL AND $2::int IS NULL) OR course_id = $2)`,
				[ifcInstrumentId, input.courseId],
			);
			nextFindingCorrelative = Number(base[0]?.c ?? 0);
		}

		const tempIdToId = new Map<string, number>();
		for (const f of input.findings) {
			const critId = criticalityByCode.get(f.criticality_code);
			if (!critId) {
				throw new HttpException({ message: ifcsValidationStrings.result[`${input.op}Failed`], errors: [`error.ifc.criticalityNotFound:${f.criticality_code}`] }, HttpStatus.BAD_REQUEST);
			}

			let realId: number;
			if (f.id === null) {
				nextFindingCorrelative += 1;
				const insertRow = await em.query(
					`INSERT INTO improvement.findings (criticality_type_id, instrument_id, staff_id, correlative, description, course_id, academic_period_id, campus_id, is_automatic, is_active)
					 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NULL, false, true)
					 RETURNING id`,
					[critId, ifcInstrumentId, input.requesterStaffId, nextFindingCorrelative, JSON.stringify(f.description), input.courseId, input.periodId],
				);
				realId = Number(insertRow[0].id);

				await em.query(
					`INSERT INTO ifc.ifc_findings (ifc_id, finding_id, is_active)
					 SELECT $1, $2, true
					 WHERE NOT EXISTS (SELECT 1 FROM ifc.ifc_findings WHERE ifc_id = $1 AND finding_id = $2)`,
					[input.ifcId, realId],
				);
			} else {
				// Update preserves instrument_id — pre-existing findings keep their original instrument.
				await em.query(`UPDATE improvement.findings SET description = $1::jsonb, criticality_type_id = $2, updated_at = NOW() WHERE id = $3`, [JSON.stringify(f.description), critId, f.id]);
				realId = f.id;
			}
			tempIdToId.set(f.tempId, realId);
		}

		// 5. Actions upsert — single correlative base for (ifcInstrumentId, courseId)
		const hasNewAction = input.actions.some((a) => a.id === null);
		let nextActionCorrelative = 0;
		if (hasNewAction) {
			const base = await em.query(
				`SELECT COALESCE(MAX(a.correlative), 0)::int AS c
				 FROM improvement.actions a
				 JOIN improvement.finding_actions fa ON fa.action_id = a.id
				 JOIN improvement.findings f         ON f.id          = fa.finding_id
				 WHERE f.instrument_id = $1
				   AND ((f.course_id IS NULL AND $2::int IS NULL) OR f.course_id = $2)`,
				[ifcInstrumentId, input.courseId],
			);
			nextActionCorrelative = Number(base[0]?.c ?? 0);
		}

		for (const a of input.actions) {
			const findingId = tempIdToId.get(a.finding_temp_id);
			IfcValidation.assertFindingTempIdResolved(findingId, input.op);

			if (a.id === null) {
				nextActionCorrelative += 1;
				const insertedAction = await em.query(
					`INSERT INTO improvement.actions (description, correlative, program_id, academic_period_id, is_active)
					 VALUES ($1::jsonb, $2, $3, $4, true)
					 RETURNING id`,
					[JSON.stringify(a.description), nextActionCorrelative, input.programId, input.periodId],
				);
				const actionId = Number(insertedAction[0].id);

				await em.query(
					`INSERT INTO improvement.finding_actions (finding_id, action_id, in_plan_required, evidences, is_active)
					 VALUES ($1, $2, false, NULL, true)`,
					[findingId, actionId],
				);
			} else {
				await em.query(`UPDATE improvement.actions SET description = $1::jsonb, updated_at = NOW() WHERE id = $2`, [JSON.stringify(a.description), a.id]);
				await em.query(`UPDATE improvement.finding_actions SET finding_id = $1 WHERE action_id = $2 AND finding_id <> $1`, [findingId, a.id]);
			}
		}
	}

	private async loadTransitionContext(ifcId: number, userId: number, schoolId: number, op: IfcOp, em?: EntityManager): Promise<IfcTransitionContext> {
		const params = [ifcId, schoolId, userId, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR, TYPE_CODES.ENTITY_TYPE.SCHOOL];
		const rows = em ? await em.query(TRANSITION_CONTEXT_SQL, params) : await this.dataSource.query(TRANSITION_CONTEXT_SQL, params);

		if (rows.length === 0) {
			throw new HttpException({ message: ifcsValidationStrings.result[`${op}Failed`], errors: [ifcsValidationStrings.error.notFound] }, HttpStatus.NOT_FOUND);
		}

		const row = rows[0];
		const ctx: IfcTransitionContext = {
			ifcId,
			ifcCourseStaffId: row.ifc_course_staff_id == null ? null : Number(row.ifc_course_staff_id),
			courseChartId: row.course_chart_id == null ? null : Number(row.course_chart_id),
			requesterStaffId: row.requester_staff_id == null ? null : Number(row.requester_staff_id),
			currentStatusCode: row.current_status_code ?? null,
		};

		IfcValidation.assertRequesterIsStaff(ctx.requesterStaffId, op);
		return ctx;
	}

	private async insertStatus(em: EntityManager | undefined, ifcId: number, requesterStaffId: number | null, newStatusCode: string, comment: I18nText | null) {
		const params = [ifcId, newStatusCode, requesterStaffId, comment ? JSON.stringify(comment) : null];
		const rows = em ? await em.query(INSERT_STATUS_SQL, params) : await this.dataSource.query(INSERT_STATUS_SQL, params);
		return rows[0];
	}

	private groupOutcomeRows(rows: any[]) {
		const programIndex = new Map<string, { program_code: string; program_name: I18nText; commissions: Map<string, any> }>();
		for (const row of rows) {
			let pg = programIndex.get(row.program_code);
			if (!pg) {
				pg = { program_code: row.program_code, program_name: row.program_name, commissions: new Map() };
				programIndex.set(row.program_code, pg);
			}
			let cm = pg.commissions.get(row.commission_code);
			if (!cm) {
				cm = { commission_code: row.commission_code, commission_name: row.commission_name, outcomes: [] as any[] };
				pg.commissions.set(row.commission_code, cm);
			}
			cm.outcomes.push({
				outcome_code: row.outcome_code,
				outcome_name: row.outcome_name,
				outcome_description: row.outcome_description,
			});
		}
		return Array.from(programIndex.values()).map((pg) => ({
			program_code: pg.program_code,
			program_name: pg.program_name,
			commissions: Array.from(pg.commissions.values()),
		}));
	}

	private assembleViewResponse(input: { header: any; findingRows: any[]; outcomeCourseRows: any[]; findingOutcomeRows: any[]; findingActionRows: any[] }) {
		const { header, findingRows, outcomeCourseRows, findingOutcomeRows, findingActionRows } = input;

		const ifc = {
			id: Number(header.ifc_id),
			information: header.information,
			extra: header.extra,
			created_at: header.ifc_created_at,
			academic_period_code: header.academic_period_code,
			program_label: header.program_label,
			area_label: header.area_label,
			subarea_label: header.subarea_label,
			course_code: header.course_code ?? null,
			course_name: header.course_name,
			course_learning_outcome: header.course_learning_outcome,
			coordinator: {
				user_id: header.coordinator_user_id === null ? null : Number(header.coordinator_user_id),
				code: header.coordinator_code ?? null,
				name: header.coordinator_name,
			},
			status: header.status_code
				? {
						code: header.status_code,
						name: header.status_name,
						color: header.status_color ?? null,
						at: header.status_at,
						comment: header.status_comment ?? null,
						by: header.status_by_name ?? null,
					}
				: null,
			requester_in_chain: Boolean(header.requester_in_chain),
		};

		const outcomesByFinding = new Map<number, any[]>();
		for (const row of findingOutcomeRows) {
			const fid = Number(row.finding_id);
			const arr = outcomesByFinding.get(fid) ?? [];
			arr.push({
				outcome_code: row.outcome_code,
				outcome_name: row.outcome_name,
				outcome_description: row.outcome_description,
				commission: { code: row.commission_code, name: row.commission_name },
			});
			outcomesByFinding.set(fid, arr);
		}

		const actionsByFinding = new Map<number, any[]>();
		for (const row of findingActionRows) {
			const fid = Number(row.finding_id);
			const arr = actionsByFinding.get(fid) ?? [];
			arr.push({
				id: Number(row.action_id),
				code: row.action_code,
				description: row.action_description,
				correlative: row.action_correlative,
				completeness_code: row.completeness_code,
				completeness_name: row.completeness_name,
			});
			actionsByFinding.set(fid, arr);
		}

		const findings = findingRows.map((row: any) => {
			const fid = Number(row.finding_id);
			return {
				id: fid,
				code: row.finding_code,
				description: row.finding_description,
				correlative: row.finding_correlative,
				is_automatic: row.is_automatic,
				criticality: { code: row.criticality_code, name: row.criticality_name, color: row.criticality_color ?? null },
				outcomes: outcomesByFinding.get(fid) ?? [],
				actions: actionsByFinding.get(fid) ?? [],
			};
		});

		return { ifc, outcome_course_result: this.groupOutcomeRows(outcomeCourseRows), findings };
	}
}

function esc(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value).replace(/[<>&"']/g, (ch) => {
		switch (ch) {
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '&':
				return '&amp;';
			case '"':
				return '&quot;';
			case "'":
				return '&#39;';
			default:
				return ch;
		}
	});
}

const LIST_SQL = `
SELECT
	c.id::int                                          AS chart_id,
	ac.code                                            AS course_code,
	ac.name                                            AS course_name,
	c_program.level_title                              AS program_label,
	u.id::int                                          AS coordinator_user_id,
	u.first_name || ' ' || u.last_name                 AS coordinator_name,
	CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object(
		'id',           i.id,
		'information',  i.information,
		'extra',        i.extra,
		'created_at',   i.created_at,
		'updated_at',   i.updated_at,
		'status_code',  ifc_st.code,
		'status_label', ifc_st.name,
		'status_color', ifc_st.extra->>'color'
	) END                                              AS ifc
FROM organization.charts c
JOIN core.types ct_entity            ON ct_entity.id = c.entity_type_id
JOIN academic.courses ac             ON ac.id = c.entity_code
JOIN organization.staff st           ON st.id = c.staff_id
JOIN organization.users u            ON u.id = st.user_id
JOIN organization.charts c_sub       ON c_sub.id     = c.root_chart_detail_id
JOIN organization.charts c_area      ON c_area.id    = c_sub.root_chart_detail_id
JOIN organization.charts c_program   ON c_program.id = c_area.root_chart_detail_id
LEFT JOIN evidence.ifcs i
	ON  i.course_id          = ac.id
	AND i.academic_period_id = $2
LEFT JOIN LATERAL (
	SELECT status_type_id
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY register_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st          ON ifc_st.id = latest_status.status_type_id
WHERE c.id = ANY($1::int[])
  AND ct_entity.code = $3
ORDER BY c.id
`;

const HEADER_SQL = `
-- NOTE: WITH RECURSIVE is required at the top of the WITH block because chain_up is
-- self-referential. The RECURSIVE keyword applies to the whole block — the non-recursive
-- CTEs (course_chart, school_check, requester_staff) coexist under it without issue.
WITH RECURSIVE course_chart AS (
	SELECT c.*
	FROM organization.charts c
	JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
	JOIN core.types ct                ON ct.id = cl.level_type_id
	WHERE ct.code               = $3
	  AND c.academic_period_id  = (SELECT academic_period_id FROM evidence.ifcs WHERE id = $1)
	  AND c.entity_code         = (SELECT course_id          FROM evidence.ifcs WHERE id = $1)
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM course_chart cc
	JOIN organization.charts c_sub     ON c_sub.id     = cc.root_chart_detail_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
	JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_detail_id
	JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
	WHERE ct_sch.code = $4
	  AND c_school.entity_code = $2
),
chain_up AS (
	SELECT id, root_chart_detail_id, staff_id
	FROM organization.charts
	WHERE id = (SELECT id FROM course_chart) AND is_active = true

	UNION ALL

	SELECT c.id, c.root_chart_detail_id, c.staff_id
	FROM organization.charts c
	JOIN chain_up cu ON c.id = cu.root_chart_detail_id
	WHERE c.is_active = true
),
requester_staff AS (
	SELECT s.id AS staff_id
	FROM organization.staff s
	WHERE s.user_id = $5
	LIMIT 1
)
SELECT
	i.id                                            AS ifc_id,
	i.information,
	i.extra,
	i.created_at                                    AS ifc_created_at,
	ap.code                                         AS academic_period_code,
	c_program.level_title                           AS program_label,
	c_area.level_title                              AS area_label,
	c_sub.level_title                               AS subarea_label,
	ac.code                                         AS course_code,
	ac.name                                         AS course_name,
	ac.learning_outcome                             AS course_learning_outcome,
	coord_u.id::int                                 AS coordinator_user_id,
	coord_prof.code                                 AS coordinator_code,
	coord_u.first_name || ' ' || coord_u.last_name  AS coordinator_name,
	ifc_st.code                                     AS status_code,
	ifc_st.name                                     AS status_name,
	(ifc_st.extra->>'color')                        AS status_color,
	latest_status.register_at                       AS status_at,
	latest_status.comment                           AS status_comment,
	u_by.first_name || ' ' || u_by.last_name        AS status_by_name,
	EXISTS (
		SELECT 1
		FROM chain_up cu, requester_staff rs
		WHERE cu.staff_id = rs.staff_id
	)                                               AS requester_in_chain
FROM evidence.ifcs i
JOIN academic.academic_periods ap ON ap.id = i.academic_period_id
JOIN academic.courses          ac ON ac.id = i.course_id
JOIN course_chart c_course        ON true
JOIN organization.charts c_sub    ON c_sub.id     = c_course.root_chart_detail_id
JOIN organization.charts c_area   ON c_area.id    = c_sub.root_chart_detail_id
JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
LEFT JOIN organization.staff   coord_st   ON coord_st.id   = c_course.staff_id
LEFT JOIN organization.users   coord_u    ON coord_u.id    = coord_st.user_id
LEFT JOIN academic.professors  coord_prof ON coord_prof.staff_id = coord_st.id
LEFT JOIN LATERAL (
	SELECT status_type_id, staff_id, register_at, comment
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY register_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st         ON ifc_st.id  = latest_status.status_type_id
LEFT JOIN organization.staff st_by  ON st_by.id   = latest_status.staff_id
LEFT JOIN organization.users u_by   ON u_by.id    = st_by.user_id
WHERE i.id = $1
  AND EXISTS (SELECT 1 FROM school_check)
`;

const FINDINGS_SQL = `
SELECT
	f.id::int                          AS finding_id,
	f.correlative                      AS finding_correlative,
	f.description                      AS finding_description,
	f.is_automatic                     AS is_automatic,
	(p_fnd.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || f.correlative::text  AS finding_code,
	crit.code                          AS criticality_code,
	crit.name                          AS criticality_name,
	(crit.extra->>'color')             AS criticality_color
FROM ifc.ifc_findings ifc_f
JOIN improvement.findings f      ON f.id    = ifc_f.finding_id
JOIN core.types crit             ON crit.id = f.criticality_type_id
JOIN evidence.instruments inst   ON inst.id = f.instrument_id
LEFT JOIN academic.courses ac    ON ac.id   = f.course_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $2) p_fnd
WHERE ifc_f.ifc_id   = $1
  AND f.is_active    = true
ORDER BY f.correlative
`;

const FINDING_OUTCOMES_SQL = `
SELECT
	fo.finding_id::int                  AS finding_id,
	o.outcome_code                      AS outcome_code,
	o.outcome_name                      AS outcome_name,
	o.outcome_description               AS outcome_description,
	comm.code                           AS commission_code,
	comm.name                           AS commission_name
FROM improvement.finding_outcomes fo
JOIN accreditation.outcomes o                ON o.id    = fo.outcome_id
JOIN accreditation.program_commissions pc    ON pc.id   = o.program_commission_id
JOIN accreditation.commissions comm          ON comm.id = pc.commission_id
WHERE fo.finding_id = ANY($1::int[])
ORDER BY fo.finding_id, o.outcome_code
`;

const FINDING_ACTIONS_SQL = `
SELECT
	fa.finding_id::int                  AS finding_id,
	a.id::int                           AS action_id,
	a.correlative                       AS action_correlative,
	a.description                       AS action_description,
	(p_acn.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || a.correlative::text   AS action_code,
	CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END  AS completeness_code,
	comp.name                           AS completeness_name
FROM improvement.finding_actions fa
JOIN improvement.actions  a      ON a.id    = fa.action_id
JOIN improvement.findings f      ON f.id    = fa.finding_id
JOIN evidence.instruments inst   ON inst.id = f.instrument_id
LEFT JOIN academic.courses ac    ON ac.id   = f.course_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $2) p_acn
LEFT JOIN core.types comp        ON comp.code = (CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END)
WHERE fa.finding_id = ANY($1::int[])
  AND a.is_active   = true
ORDER BY fa.finding_id, a.correlative
`;

const OUTCOME_COURSE_BY_IFC_SQL = `
SELECT
	p.code                              AS program_code,
	p.name                              AS program_name,
	comm.code                           AS commission_code,
	comm.name                           AS commission_name,
	o.outcome_code                      AS outcome_code,
	o.outcome_name                      AS outcome_name,
	o.outcome_description               AS outcome_description
FROM evidence.ifcs i
JOIN academic.study_plan_courses spc        ON spc.course_id = i.course_id
JOIN academic.course_outcome_mappings m     ON m.study_plan_course_id = spc.id
JOIN accreditation.outcomes o               ON o.id    = m.outcome_id
JOIN accreditation.program_commissions pc   ON pc.id   = o.program_commission_id
JOIN academic.programs p                    ON p.id    = pc.program_id
JOIN accreditation.commissions comm         ON comm.id = pc.commission_id
WHERE i.id = $1
ORDER BY p.code, comm.code, o.outcome_code
`;

const OUTCOME_COURSE_BY_CHART_SQL = `
SELECT
	p.code                              AS program_code,
	p.name                              AS program_name,
	comm.code                           AS commission_code,
	comm.name                           AS commission_name,
	o.outcome_code                      AS outcome_code,
	o.outcome_name                      AS outcome_name,
	o.outcome_description               AS outcome_description
FROM organization.charts c_course
JOIN academic.courses ac                    ON ac.id = c_course.entity_code
JOIN academic.study_plan_courses spc        ON spc.course_id = ac.id
JOIN academic.course_outcome_mappings m     ON m.study_plan_course_id = spc.id
JOIN accreditation.outcomes o               ON o.id    = m.outcome_id
JOIN accreditation.program_commissions pc   ON pc.id   = o.program_commission_id
JOIN academic.programs p                    ON p.id    = pc.program_id
JOIN accreditation.commissions comm         ON comm.id = pc.commission_id
WHERE c_course.id = $1
ORDER BY p.code, comm.code, o.outcome_code
`;

const TRANSITION_CONTEXT_SQL = `
WITH course_chart AS (
	SELECT c.id AS course_chart_id, c.staff_id
	FROM organization.charts c
	JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
	JOIN core.types ct                ON ct.id = cl.level_type_id
	WHERE ct.code               = $4
	  AND c.academic_period_id  = (SELECT academic_period_id FROM evidence.ifcs WHERE id = $1)
	  AND c.entity_code         = (SELECT course_id          FROM evidence.ifcs WHERE id = $1)
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM organization.charts c
	JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
	JOIN core.types ct                ON ct.id = cl.level_type_id
	WHERE ct.code               = $4
	  AND c.academic_period_id  = (SELECT academic_period_id FROM evidence.ifcs WHERE id = $1)
	  AND c.entity_code         = (SELECT course_id          FROM evidence.ifcs WHERE id = $1)
	  AND c.is_active           = true
	  AND EXISTS (
			SELECT 1
			FROM organization.charts c_sub
			JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
			JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
			JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_detail_id
			JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
			WHERE c_sub.id           = c.root_chart_detail_id
			  AND ct_sch.code        = $5
			  AND c_school.entity_code = $2
	  )
)
SELECT
	(SELECT course_chart_id FROM course_chart)::int AS course_chart_id,
	(SELECT staff_id FROM course_chart)::int        AS ifc_course_staff_id,
	rs.id::int                                       AS requester_staff_id,
	ifc_st.code                                      AS current_status_code
FROM evidence.ifcs i
LEFT JOIN organization.staff rs ON rs.user_id = $3
LEFT JOIN LATERAL (
	SELECT status_type_id
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY register_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st ON ifc_st.id = latest_status.status_type_id
WHERE i.id = $1
  AND EXISTS (SELECT 1 FROM school_check)
`;

const INSERT_STATUS_SQL = `
WITH new_status AS (
	INSERT INTO ifc.statuses (ifc_id, status_type_id, staff_id, register_at, comment, is_active)
	SELECT $1, t.id, $3, NOW(), $4::jsonb, true
	FROM core.types t
	WHERE t.code = $2
	RETURNING id, ifc_id, status_type_id, staff_id, register_at, comment
)
SELECT
	t.code                                                   AS code,
	t.name                                                   AS name,
	ns.register_at                                           AS at,
	ns.comment                                               AS comment,
	u.first_name || ' ' || u.last_name                       AS by
FROM new_status ns
JOIN core.types t       ON t.id  = ns.status_type_id
LEFT JOIN organization.staff st ON st.id = ns.staff_id
LEFT JOIN organization.users u  ON u.id  = st.user_id
`;

const PREFILL_HEADER_SQL = `
WITH course_chart AS (
	SELECT c.*
	FROM organization.charts c
	JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
	JOIN core.types ct                ON ct.id = cl.level_type_id
	WHERE c.id                  = $1
	  AND ct.code               = $4
	  AND c.academic_period_id  = $2
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM course_chart cc
	JOIN organization.charts c_sub     ON c_sub.id     = cc.root_chart_detail_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
	JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_detail_id
	JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
	WHERE ct_sch.code = $5
	  AND c_school.entity_code = $3
)
SELECT
	ap.code                                         AS academic_period_code,
	c_area.level_title                              AS area_label,
	c_sub.level_title                               AS subarea_label,
	ac.name                                         AS course_name,
	ac.learning_outcome                             AS course_learning_outcome,
	coord_u.id::int                                 AS coordinator_user_id,
	coord_prof.code                                 AS coordinator_code,
	coord_u.first_name || ' ' || coord_u.last_name  AS coordinator_name
FROM course_chart c_course
JOIN academic.academic_periods ap   ON ap.id = c_course.academic_period_id
JOIN academic.courses          ac   ON ac.id = c_course.entity_code
JOIN organization.charts c_sub      ON c_sub.id  = c_course.root_chart_detail_id
JOIN organization.charts c_area     ON c_area.id = c_sub.root_chart_detail_id
LEFT JOIN organization.staff   coord_st   ON coord_st.id   = c_course.staff_id
LEFT JOIN organization.users   coord_u    ON coord_u.id    = coord_st.user_id
LEFT JOIN academic.professors  coord_prof ON coord_prof.staff_id = coord_st.id
WHERE EXISTS (SELECT 1 FROM school_check)
`;

const CHART_RESOLUTION_SQL = `
WITH course_chart AS (
	SELECT c.*
	FROM organization.charts c
	JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
	JOIN core.types ct                ON ct.id = cl.level_type_id
	WHERE c.id                  = $1
	  AND ct.code               = $4
	  AND c.academic_period_id  = $2
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM course_chart cc
	JOIN organization.charts c_sub     ON c_sub.id     = cc.root_chart_detail_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
	JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_detail_id
	JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
	WHERE ct_sch.code = $5
	  AND c_school.entity_code = $3
)
SELECT
	c_course.entity_code::int    AS course_id,
	c_course.staff_id::int       AS ifc_course_staff_id,
	c_program.entity_code::int   AS program_id,
	rs.id::int                    AS requester_staff_id
FROM course_chart c_course
JOIN organization.charts c_sub     ON c_sub.id     = c_course.root_chart_detail_id
JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
LEFT JOIN organization.staff rs    ON rs.user_id = $6
WHERE EXISTS (SELECT 1 FROM school_check)
`;

const REPORT_CODES_SQL = `
WITH school_check AS (
	SELECT 1
	WHERE NOT EXISTS (
		SELECT 1
		FROM organization.charts c0
		WHERE c0.id = ANY($1::int[])
		  AND NOT EXISTS (
				SELECT 1
				FROM organization.charts c_sub
				JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
				JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
				JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_detail_id
				JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
				WHERE c_sub.id            = c0.root_chart_detail_id
				  AND ct_sch.code         = $3
				  AND c_school.entity_code = $2
		  )
	)
),
target_programs AS (
	SELECT DISTINCT p.code AS code
	FROM organization.charts c
	JOIN organization.charts c_sub     ON c_sub.id     = c.root_chart_detail_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
	JOIN academic.programs p           ON p.id         = c_program.entity_code
	WHERE c.id = ANY($1::int[])
	  AND EXISTS (SELECT 1 FROM school_check)
)
SELECT
	(SELECT code FROM organization.schools WHERE id = $2) AS school_code,
	COALESCE(ARRAY(SELECT code FROM target_programs ORDER BY code), '{}') AS program_codes
`;

const STATUS_REPORT_SQL = `
WITH school_check AS (
	SELECT 1
	WHERE NOT EXISTS (
		SELECT 1
		FROM organization.charts c0
		WHERE c0.id = ANY($1::int[])
		  AND NOT EXISTS (
				SELECT 1
				FROM organization.charts c_sub
				JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
				JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
				JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_detail_id
				JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
				WHERE c_sub.id            = c0.root_chart_detail_id
				  AND ct_sch.code         = $5
				  AND c_school.entity_code = $3
		  )
	)
),
target_charts AS (
	SELECT c.id, c.entity_code AS course_id, c.root_chart_detail_id, c.staff_id, c.level_title
	FROM organization.charts c
	JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
	JOIN core.types ct                ON ct.id = cl.level_type_id
	WHERE c.id        = ANY($1::int[])
	  AND ct.code     = $4
	  AND c.is_active = true
)
SELECT
	tc.level_title->>$6                                     AS course_name,
	c_area.level_title->>$6                                 AS area_label,
	c_program.level_title->>$6                              AS program_label,
	coord_u.first_name || ' ' || coord_u.last_name          AS coordinator_name,
	coord_u.email                                           AS coordinator_email,
	coord_prof.code                                         AS coordinator_code,
	ifc_st.code                                             AS status_code
FROM target_charts tc
JOIN organization.charts c_sub      ON c_sub.id     = tc.root_chart_detail_id
JOIN organization.charts c_area     ON c_area.id    = c_sub.root_chart_detail_id
JOIN organization.charts c_program  ON c_program.id = c_area.root_chart_detail_id
LEFT JOIN organization.staff coord_st  ON coord_st.id = tc.staff_id
LEFT JOIN organization.users coord_u   ON coord_u.id  = coord_st.user_id
LEFT JOIN academic.professors coord_prof ON coord_prof.staff_id = coord_st.id
LEFT JOIN evidence.ifcs i
	ON  i.course_id          = tc.course_id
	AND i.academic_period_id = $2
LEFT JOIN LATERAL (
	SELECT status_type_id
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY register_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st ON ifc_st.id = latest_status.status_type_id
WHERE EXISTS (SELECT 1 FROM school_check)
ORDER BY c_program.level_title->>$6 ASC, c_area.level_title->>$6 ASC, tc.level_title->>$6 ASC
`;

const PROGRAM_BY_COURSE_PERIOD_SQL = `
SELECT c_program.entity_code::int AS program_id
FROM organization.charts c_course
JOIN organization.chart_levels cl  ON cl.id = c_course.chart_level_id
JOIN core.types ct                 ON ct.id = cl.level_type_id
JOIN organization.charts c_sub     ON c_sub.id     = c_course.root_chart_detail_id
JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
WHERE c_course.entity_code        = $1
  AND c_course.academic_period_id = $2
  AND ct.code                     = $3
  AND c_course.is_active          = true
LIMIT 1
`;
