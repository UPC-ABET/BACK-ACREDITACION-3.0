import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { readCell, readI18nCells } from 'src/libs/excel.functions';

import { ChartRow, UploadResult, UploadRowError } from '../model/charts-upload.types';
import type { ChartsUploadDto } from '../model/charts-upload.dtos';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	chartsErrorMessages,
	chartsTemplateLabels,
	languageDisplayNames,
} from '../model/charts-template.labels';
import { DEFAULT_LANGUAGES } from 'src/modules/core/parameters/constants/parameter-codes';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { uploadLogsValidationStrings } from '../../upload-logs/config/strings/upload-logs.validation';
import { ChartsUploadRepository } from '../core/charts-upload.repository';
import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { UserService } from 'src/modules/organization/users/api/users.service';
import { ROLE_CODES } from 'src/shared/constants/role-codes';

const SINGLE_COLUMNS_BEFORE_TITLE = 2; // code, parentCode
const SINGLE_COLUMNS_AFTER_TITLE = 4; // professorCode, email, entityType, entityCode

// School, Dean and Program are excluded: all three are written only by chart-heads
// pre-configuration, never by this upload. A row still reaches a program by naming its code in
// parentCode (see fn_upload_charts), not by tagging itself with entityType = Program.
const UPLOADABLE_ENTITY_TYPE_CODES: string[] = [
	TYPE_CODES.ENTITY_TYPE.AREA,
	TYPE_CODES.ENTITY_TYPE.SUBAREA,
	TYPE_CODES.ENTITY_TYPE.COURSE,
];
const ENTITY_TYPE_CODES_REQUIRING_CODE: string[] = [TYPE_CODES.ENTITY_TYPE.COURSE];
const TEMPLATE_MAX_ROWS = 1000;

@Injectable()
export class ChartsUploadService {
	private readonly logger = new Logger(ChartsUploadService.name);

	constructor(
		private readonly repository: ChartsUploadRepository,
		private readonly uploadLogService: UploadLogService,
		private readonly userService: UserService,
	) {}

	async processUpload(
		fileBuffer: Buffer,
		fileName: string,
		userId: number,
		schoolId: number,
		academicPeriodId: number,
		dto: ChartsUploadDto,
	): Promise<UploadResult> {
		await this.uploadLogService.assertAcademicPeriodExists(academicPeriodId);
		// The school's chart node (Dean -> School Director configuration) must already exist; the
		// upload hangs the Program Coordinator subtree under it.
		if (!(await this.repository.schoolChartExists(schoolId, academicPeriodId))) {
			throw new HttpException(
				{
					message: uploadLogsValidationStrings.error.schoolChartNotConfigured,
					errors: [`schoolId=${schoolId}`, `academicPeriodId=${academicPeriodId}`],
				},
				HttpStatus.BAD_REQUEST,
			);
		}
		if (await this.repository.chartsLoadedForSchoolPeriod(schoolId, academicPeriodId)) {
			throw new HttpException(
				{
					message: uploadLogsValidationStrings.error.chartsAlreadyLoadedForPeriod,
					errors: [`schoolId=${schoolId}`, `academicPeriodId=${academicPeriodId}`],
				},
				HttpStatus.CONFLICT,
			);
		}
		const ifcRoleId = await this.repository.getActiveRoleIdByCode(ROLE_CODES.IFC);
		if (ifcRoleId === null) {
			throw new HttpException(
				{
					message: uploadLogsValidationStrings.error.ifcRoleNotConfigured,
					errors: [`roleCode=${ROLE_CODES.IFC}`],
				},
				HttpStatus.BAD_REQUEST,
			);
		}

		const language = this.resolveLanguage(dto.lang);
		const labels = chartsTemplateLabels[language];
		const messages = chartsErrorMessages[language];
		const languages = await this.getLanguages();

		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook, languages);

		const result = await this.repository.callUploadFunction(
			rows,
			academicPeriodId,
			schoolId,
			userId,
			fileName,
		);

		const errors: UploadRowError[] = result
			.filter((r) => r.error_code !== null)
			.map((r) => ({ rowNumber: r.row_number as number, errorCode: r.error_code as string }));

		if (errors.length > 0) {
			const excel = await this.annotateErrors(
				workbook,
				errors,
				languages.length,
				labels.errorColumn,
				messages,
			);
			return {
				success: false,
				uploadLogId: null,
				totalRows: rows.length,
				loadedRows: 0,
				errorRows: errors.length,
				excelWithErrors: excel,
				fileName: labels.errorsFileName,
			};
		}

		await this.provisionUsers(rows, ifcRoleId);

		const uploadLogId = result.find((r) => r.upload_log_id !== null)?.upload_log_id ?? null;
		return {
			success: true,
			uploadLogId,
			totalRows: rows.length,
			loadedRows: rows.length,
			errorRows: 0,
			excelWithErrors: null,
			fileName: null,
		};
	}

	private async provisionUsers(rows: ChartRow[], ifcRoleId: number): Promise<void> {
		const codes = [...new Set(rows.map((r) => r.professorCode).filter(Boolean))];
		if (codes.length === 0) return;

		const staffList = await this.repository.getStaffForProvisioning(codes);
		for (const staff of staffList) {
			if (staff.userId !== null || !staff.email) continue;
			try {
				const existingUserId = await this.repository.findActiveUserIdByEmail(staff.email);
				if (existingUserId !== null) {
					await this.repository.linkStaffToUser(staff.staffId, existingUserId);
					continue;
				}
				const created = await this.userService.create({
					email: staff.email,
					firstName: staff.firstName,
					lastName: staff.lastName,
					staffId: staff.staffId,
				});
				await this.repository.assignUserRole(created.id, ifcRoleId);
			} catch (error) {
				this.logger.error(
					`IFC user provisioning failed for staffId=${staff.staffId} email=${staff.email}: ${
						error instanceof Error ? error.message : 'unknown error'
					}`,
				);
			}
		}
	}

	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		await this.uploadLogService.assertRollbackable(uploadLogId);
		try {
			await this.repository.callRollbackFunction(uploadLogId);
		} catch (err) {
			this.uploadLogService.rethrowRollbackError(err);
		}
		return { success: true };
	}

	async generateTemplate(lang: string): Promise<{ buffer: Buffer; fileName: string }> {
		const language = this.resolveLanguage(lang);
		const labels = chartsTemplateLabels[language];
		const displayNames = languageDisplayNames[language];
		const languages = await this.getLanguages();
		const entityTypes = await this.repository.getEntityTypes(language);

		const workbook = new ExcelJS.Workbook();

		const dataSheet = workbook.addWorksheet('Template');
		const headers = [
			labels.code,
			labels.parentCode,
			...languages.map((l) => `${labels.title} (${displayNames[l] ?? l})`),
			labels.professorCode,
			labels.email,
			labels.entityType,
			labels.entityCode,
		];
		dataSheet.addRow(headers);
		this.styleHeaderRow(dataSheet, headers);

		this.applyEntityTypeDropdown(dataSheet, languages.length, entityTypes);
		this.addEntityTypeLegend(workbook, labels, entityTypes);

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { buffer, fileName: labels.templateFileName };
	}

	private addEntityTypeLegend(
		workbook: ExcelJS.Workbook,
		labels: Record<string, string>,
		entityTypes: Array<{ code: string; name: string }>,
	): void {
		const uploadable = entityTypes.filter((t) => UPLOADABLE_ENTITY_TYPE_CODES.includes(t.code));
		if (uploadable.length === 0) return;

		const sheet = workbook.addWorksheet(labels.entityLegendSheet);
		const headers = [labels.entityType, labels.legendEntityCodeUsage];
		sheet.addRow(headers);
		this.styleHeaderRow(sheet, headers);

		for (const entityType of uploadable) {
			const requiresCode = ENTITY_TYPE_CODES_REQUIRING_CODE.includes(entityType.code);
			sheet.addRow([entityType.name, requiresCode ? labels.legendYes : labels.legendNo]);
		}

		sheet.addRow([]);
		sheet.addRow([labels.parentCodeHint]);
		sheet.mergeCells(sheet.lastRow!.number, 1, sheet.lastRow!.number, 2);
		sheet.lastRow!.getCell(1).alignment = { wrapText: true };
	}

	// Locks the entity-type column to a dropdown of the uploadable tags (localized names). Blank stays
	// allowed for generic intermediate units; the chosen name is mapped back to its type on upload.
	private applyEntityTypeDropdown(
		sheet: ExcelJS.Worksheet,
		languageCount: number,
		entityTypes: Array<{ code: string; name: string }>,
	): void {
		const names = entityTypes
			.filter((t) => UPLOADABLE_ENTITY_TYPE_CODES.includes(t.code))
			.map((t) => t.name);
		if (names.length === 0) return;
		// columns: code, parentCode, title×L, professorCode, email, entityType, entityCode
		const column = SINGLE_COLUMNS_BEFORE_TITLE + languageCount + 3;
		const formula = `"${names.join(',')}"`;
		for (let row = 2; row <= TEMPLATE_MAX_ROWS; row++) {
			sheet.getCell(row, column).dataValidation = {
				type: 'list',
				allowBlank: true,
				formulae: [formula],
			};
		}
	}

	private styleHeaderRow(sheet: ExcelJS.Worksheet, headers: string[], rowNumber = 1): void {
		const row = sheet.getRow(rowNumber);
		row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		row.eachCell((cell, colNumber) => {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
			sheet.getColumn(colNumber).width = headers[colNumber - 1].length + 2;
		});
	}

	private resolveLanguage(lang?: string): string {
		return lang && chartsTemplateLabels[lang] ? lang : DEFAULT_TEMPLATE_LANGUAGE;
	}

	private async getLanguages(): Promise<string[]> {
		return (await this.repository.getSupportedLanguages()) ?? DEFAULT_LANGUAGES;
	}

	// Positional layout (header ignored), L = languages.length:
	// code | parentCode | title×L | professorCode | email | entityType (localized name) | entityCode
	private parseWorkbook(workbook: ExcelJS.Workbook, languages: string[]): ChartRow[] {
		const worksheet = workbook.worksheets[0];
		const L = languages.length;
		const rows: ChartRow[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			let col = 1;
			const code = readCell(row, col++);
			const parentCode = readCell(row, col++);
			const title = readI18nCells(row, col, languages);
			col += L;
			const professorCode = readCell(row, col++);
			const email = readCell(row, col++);
			const entityType = readCell(row, col++);
			const entityCode = readCell(row, col);

			rows.push({
				rowNumber,
				code,
				parentCode,
				title,
				professorCode,
				email,
				entityType,
				entityCode,
			});
		});
		return rows;
	}

	private async annotateErrors(
		workbook: ExcelJS.Workbook,
		errors: UploadRowError[],
		languageCount: number,
		errorColumnHeader: string,
		messages: Record<string, string>,
	): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn =
			SINGLE_COLUMNS_BEFORE_TITLE + languageCount + SINGLE_COLUMNS_AFTER_TITLE + 1;
		const headerCell = worksheet.getRow(1).getCell(errorColumn);
		headerCell.value = errorColumnHeader;
		headerCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
		worksheet.getColumn(errorColumn).width = errorColumnHeader.length + 2;

		const byRow = new Map<number, string[]>();
		for (const e of errors) {
			const list = byRow.get(e.rowNumber) ?? [];
			list.push(messages[e.errorCode] ?? e.errorCode);
			byRow.set(e.rowNumber, list);
		}
		for (const [rowNumber, texts] of byRow) {
			worksheet.getRow(rowNumber).getCell(errorColumn).value = texts.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
