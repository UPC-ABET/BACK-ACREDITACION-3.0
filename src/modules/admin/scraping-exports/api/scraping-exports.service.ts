import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Writable } from 'stream';

import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import { GradesRcExportRepository } from '../core/grades-rc-export.repository';
import { ScrapingExportGradesRcRowRepository } from '../core/scraping-export-gradesrc-row.repository';
import {
	EnrolledStudentExportRow,
	GRADES_RC_PAGE_SIZE,
	GradeRcExportRow,
	SectionExportRow,
	StaffExportRow,
	StudentSectionExportRow,
} from '../model/scraping-exports.types';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	ExportLabels,
	enrolledStudentExportLabels,
	gradesRcDescriptiveLabels,
	gradesRcExportLabels,
	sectionExportLabels,
	staffExportLabels,
	studentSectionExportLabels,
} from '../model/scraping-exports.labels';

export interface GeneratedExcel {
	buffer: Buffer;
	fileName: string;
}

// Rows buffered before each `insertBatch` call while streaming the merge into the child table —
// keeps peak memory bounded to one chunk regardless of how large the period's merge is, instead of
// holding the entire period in memory before writing anything.
const MATERIALIZE_BATCH_SIZE = 1000;

@Injectable()
export class ScrapingExportsService {
	private readonly logger = new Logger(ScrapingExportsService.name);

	constructor(
		private readonly repository: ScrapingExportsRepository,
		private readonly gradesRcRepository: GradesRcExportRepository,
		private readonly gradesRcRowRepository: ScrapingExportGradesRcRowRepository,
	) {}

	// %% SYNC EXPORTS — fetch is language-neutral (called once per generation); render applies
	// labels for a requested language (called once per download). Splitting these is what lets
	// generation persist `rowsData` once and download render it for any supported language without
	// re-querying the raw datasource.

	async fetchStaffRows(academicPeriodId: number | null): Promise<StaffExportRow[]> {
		return await this.repository.getStaff(academicPeriodId);
	}

	renderStaffExcel(rows: StaffExportRow[], lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(staffExportLabels, lang);
		const data = rows.map((r) => [r.professorCode, r.lastName, r.firstName, r.email]);
		return this.buildExcel(labels, data);
	}

	async fetchSectionRows(academicPeriodId: number | null): Promise<SectionExportRow[]> {
		return await this.repository.getSections(academicPeriodId);
	}

	renderSectionsExcel(rows: SectionExportRow[], lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(sectionExportLabels, lang);
		const data = rows.map((r) => [
			r.courseCode,
			r.sectionCode,
			r.professorCode,
			r.campusCode,
			r.sectionModalityTypeCode,
		]);
		return this.buildExcel(labels, data);
	}

	async fetchEnrolledStudentRows(
		academicPeriodId: number | null,
	): Promise<EnrolledStudentExportRow[]> {
		return await this.repository.getEnrolledStudents(academicPeriodId);
	}

	renderEnrolledStudentsExcel(
		rows: EnrolledStudentExportRow[],
		lang?: string,
	): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(enrolledStudentExportLabels, lang);
		const data = rows.map((r) => [
			r.studentCode,
			r.lastName,
			r.firstName,
			r.programCode,
			r.campusCode,
			r.enrollmentModalityTypeCode,
		]);
		return this.buildExcel(labels, data);
	}

	async fetchStudentSectionRows(
		academicPeriodId: number | null,
	): Promise<StudentSectionExportRow[]> {
		return await this.repository.getStudentSections(academicPeriodId);
	}

	renderStudentSectionsExcel(
		rows: StudentSectionExportRow[],
		lang?: string,
	): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(studentSectionExportLabels, lang);
		const data = rows.map((r) => [r.sectionCode, r.studentCode]);
		return this.buildExcel(labels, data);
	}

	// %% GRADES RC — materialize runs the Banner+Planner merge once and copies it, language-neutral,
	// into the durable scraping_export_gradesrc_rows table; render pages that table back out into a
	// requested language's workbook. Neither touches the other's connection: materialize is the only
	// caller of GradesRcExportRepository (the `exports-raw` connection), render only ever reads the
	// main-datasource child table. See ADR-003.

	// The pooled `exports-raw` connection `openGradesRcExport` pins is held only for the merge and
	// this single ingestion pass, then released -- materially less than the old design, which held
	// it through the entire render too.
	//
	// Flushes every MATERIALIZE_BATCH_SIZE rows instead of collecting the whole merge into one array
	// first: a full period's grade lines held entirely in memory before the first insert is exactly
	// the OOM risk `scraping_export_gradesrc_rows` exists to eliminate (see ADR-003).
	async materializeGradesRc(
		academicPeriodId: number,
		scrapingExportRunId: number,
		generatedAt: Date,
	): Promise<void> {
		const handle = await this.gradesRcRepository.openGradesRcExport(academicPeriodId);
		try {
			let batch: Array<GradeRcExportRow & { hasObservations: boolean }> = [];
			for await (const row of handle.rows()) {
				batch.push(row);
				if (batch.length >= MATERIALIZE_BATCH_SIZE) {
					await this.gradesRcRowRepository.insertBatch(scrapingExportRunId, generatedAt, batch);
					batch = [];
				}
			}
			if (batch.length > 0) {
				await this.gradesRcRowRepository.insertBatch(scrapingExportRunId, generatedAt, batch);
			}
		} finally {
			await handle.close();
		}
	}

	// `generatedAt` pins the read to one specific completed batch (see
	// ScrapingExportGradesRcRowRepository.readPage) so a download racing a regenerate reads one
	// self-consistent generation instead of a torn mix of the old and new rows.
	async renderGradesRc(
		scrapingExportRunId: number,
		generatedAt: Date,
		lang?: string,
	): Promise<GeneratedExcel> {
		const chunks: Buffer[] = [];
		const sink = new Writable({
			write(chunk: Buffer, _encoding, callback) {
				chunks.push(chunk);
				callback();
			},
		});

		const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sink, useStyles: true });
		const labels = this.resolveLabels(gradesRcExportLabels, lang);
		await this.writeGradesRcSheets(workbook, scrapingExportRunId, generatedAt, labels, lang);

		return { buffer: Buffer.concat(chunks), fileName: labels.fileName };
	}

	private async writeGradesRcSheets(
		workbook: ExcelJS.stream.xlsx.WorkbookWriter,
		scrapingExportRunId: number,
		generatedAt: Date,
		labels: ExportLabels,
		lang: string | undefined,
	): Promise<void> {
		// Sheet order is load-bearing: the upload parses worksheets[0], and the writer streams sheets
		// in creation order.
		//
		// The two are disjoint halves split on whether the row carries an observation, so this one
		// uploads without a single rejection.
		//
		// The cost is that a row which WOULD upload fine but carries an observation -- a withdrawn
		// student's 0/RET, a genuine unexplained 0 -- is held back with no way through: the upload
		// parses worksheets[0] only, and the review sheet is 16 descriptive columns rather than this
		// 6-column template. Observations that clear once someone fixes the source (a fallback grade,
		// an unregistered type, a missing enrollment) come back in the next download; COURSE_LEVEL_STATUS
		// and ZERO_GRADE_UNEXPLAINED never do, so those enrollments stay out of
		// academic.student_course_grades permanently. ZERO_GRADE_UNEXPLAINED ships ASISTIO, which is
		// the one status the RC semaphore counts -- holding it back moves the RC average.
		const uploadSheet = this.startSheet(workbook, 'Data', labels.headers);
		for await (const r of this.pageGradesRcRows(scrapingExportRunId, generatedAt, false)) {
			uploadSheet
				.addRow([
					r.sectionCode,
					r.studentCode,
					r.gradeTypeCode,
					r.gradeTypePercentage,
					r.grade,
					r.qualificationStatusCode,
				])
				.commit();
		}
		uploadSheet.commit();

		const descriptive = this.resolveLabels(gradesRcDescriptiveLabels, lang);
		// The observations are full sentences, so the last column gets room for one.
		const detailSheet = this.startSheet(workbook, descriptive.sheetName, descriptive.headers, {
			[descriptive.headers.length]: 90,
		});
		for await (const r of this.pageGradesRcRows(scrapingExportRunId, generatedAt, true)) {
			detailSheet
				.addRow([
					r.academicPeriod,
					r.sectionCode,
					r.courseCode,
					r.courseName,
					r.studentCode,
					r.studentName,
					r.careerCode,
					r.gradeTypeCode,
					r.gradeTypeName,
					r.gradeTypePercentage,
					r.grade,
					r.qualificationStatusCode,
					r.qualificationStatusName,
					r.source,
					r.scrapedAt,
					(r.observations ?? []).map((code) => descriptive.observations[code] ?? code).join(' | '),
				])
				.commit();
		}
		detailSheet.commit();

		await workbook.commit();
	}

	private async *pageGradesRcRows(
		scrapingExportRunId: number,
		generatedAt: Date,
		hasObservations: boolean,
	): AsyncGenerator<GradeRcExportRow> {
		let lastId = 0;
		for (;;) {
			const page = await this.gradesRcRowRepository.readPage(
				scrapingExportRunId,
				generatedAt,
				hasObservations,
				lastId,
				GRADES_RC_PAGE_SIZE,
			);
			if (page.length === 0) return;

			for (const row of page) yield row;
			lastId = page[page.length - 1].id;
		}
	}

	// Widths have to be set before the first commit: the writer seals the sheet's metadata then.
	private startSheet(
		workbook: ExcelJS.stream.xlsx.WorkbookWriter,
		name: string,
		headers: string[],
		wideColumns: Record<number, number> = {},
	): ExcelJS.Worksheet {
		const sheet = workbook.addWorksheet(name);
		sheet.columns = headers.map((header, index) =>
			wideColumns[index + 1]
				? { width: wideColumns[index + 1], style: { alignment: { wrapText: true } } }
				: { width: header.length + 2 },
		);

		const headerRow = sheet.addRow(headers);
		headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		headerRow.eachCell((cell) => {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
		});
		headerRow.commit();
		return sheet;
	}

	private resolveLabels<T>(map: Record<string, T>, lang?: string): T {
		return lang && map[lang] ? map[lang] : map[DEFAULT_TEMPLATE_LANGUAGE];
	}

	private async buildExcel(labels: ExportLabels, data: string[][]): Promise<GeneratedExcel> {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Data');

		sheet.addRow(labels.headers);
		this.styleHeaderRow(sheet, labels.headers);
		for (const row of data) sheet.addRow(row);

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { buffer, fileName: labels.fileName };
	}

	// Same red bold header as the uploads/* template generators, so generated files look like the
	// templates they feed.
	private styleHeaderRow(sheet: ExcelJS.Worksheet, headers: string[], rowNumber = 1): void {
		const row = sheet.getRow(rowNumber);
		row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		row.eachCell((cell, colNumber) => {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
			sheet.getColumn(colNumber).width = headers[colNumber - 1].length + 2;
		});
	}
}
