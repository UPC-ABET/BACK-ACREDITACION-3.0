import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

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

const SINGLE_COLUMNS_BEFORE_TITLE = 2; // code, parentCode
const SINGLE_COLUMNS_AFTER_TITLE = 3; // email, entityType, entityCode

// Entity-type tags a chart node may declare in this upload (School/Dean come from the prior
// configuration, so they are excluded). Blank is allowed for generic intermediate units.
const UPLOADABLE_ENTITY_TYPE_CODES: string[] = [
	TYPE_CODES.ENTITY_TYPE.PROGRAM,
	TYPE_CODES.ENTITY_TYPE.AREA,
	TYPE_CODES.ENTITY_TYPE.SUBAREA,
	TYPE_CODES.ENTITY_TYPE.COURSE,
];
const TEMPLATE_MAX_ROWS = 1000;

@Injectable()
export class ChartsUploadService {
	constructor(
		private readonly repository: ChartsUploadRepository,
		private readonly uploadLogService: UploadLogService,
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
			labels.email,
			labels.entityType,
			labels.entityCode,
		];
		dataSheet.addRow(headers);
		this.styleHeaderRow(dataSheet, headers);

		this.applyEntityTypeDropdown(dataSheet, languages.length, entityTypes);

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { buffer, fileName: labels.templateFileName };
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
		// columns: code, parentCode, title×L, email, entityType, entityCode
		const column = SINGLE_COLUMNS_BEFORE_TITLE + languageCount + 2;
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
	// code | parentCode | title×L | email | entityType (localized name) | entityCode
	private parseWorkbook(workbook: ExcelJS.Workbook, languages: string[]): ChartRow[] {
		const worksheet = workbook.worksheets[0];
		const L = languages.length;
		const rows: ChartRow[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			let col = 1;
			const code = this.cell(row, col++);
			const parentCode = this.cell(row, col++);
			const title = this.i18nCells(row, col, languages);
			col += L;
			const email = this.cell(row, col++);
			const entityType = this.cell(row, col++);
			const entityCode = this.cell(row, col);

			rows.push({
				rowNumber,
				code,
				parentCode,
				title,
				email,
				entityType,
				entityCode,
			});
		});
		return rows;
	}

	private i18nCells(
		row: ExcelJS.Row,
		startCol: number,
		languages: string[],
	): Record<string, string> {
		const result: Record<string, string> = {};
		languages.forEach((lang, i) => {
			result[lang] = this.cell(row, startCol + i);
		});
		return result;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
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
