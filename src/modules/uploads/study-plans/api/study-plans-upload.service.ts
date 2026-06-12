import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import {
	StudyPlanRow,
	UploadResult,
	UploadRowError,
	parseElective,
} from '../model/study-plans-upload.types';
import type { StudyPlansUploadDto } from '../model/study-plans-upload.dtos';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	languageDisplayNames,
	studyPlansErrorMessages,
	studyPlansTemplateLabels,
} from '../model/study-plans-template.labels';
import { DEFAULT_LANGUAGES } from 'src/modules/core/parameters/constants/parameter-codes';
import { StudyPlansUploadRepository } from '../core/study-plans-upload.repository';
import { UploadLogService } from '../../upload-logs/api/upload-logs.service';

@Injectable()
export class StudyPlansUploadService {
	constructor(
		private readonly repository: StudyPlansUploadRepository,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(
		fileBuffer: Buffer,
		fileName: string,
		userId: number,
		academicPeriodId: number,
		modalityTypeId: number,
		dto: StudyPlansUploadDto,
	): Promise<UploadResult> {
		await this.uploadLogService.assertAcademicPeriodExists(academicPeriodId);

		const language = this.resolveLanguage(dto.lang);
		const labels = studyPlansTemplateLabels[language];
		const messages = studyPlansErrorMessages[language];
		const languages = await this.getLanguages();

		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook, languages);

		const result = await this.repository.callUploadFunction(
			rows,
			academicPeriodId,
			userId,
			fileName,
			modalityTypeId,
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
		const language = studyPlansTemplateLabels[lang] ? lang : DEFAULT_TEMPLATE_LANGUAGE;
		const labels = studyPlansTemplateLabels[language];
		const displayNames = languageDisplayNames[language];
		const languages = await this.getLanguages();

		const workbook = new ExcelJS.Workbook();

		const dataSheet = workbook.addWorksheet('Template');
		const headers = [
			labels.studyPlanCode,
			...languages.map((l) => `${labels.studyPlanName} (${displayNames[l] ?? l})`),
			labels.programCode,
			labels.level,
			labels.courseCode,
			...languages.map((l) => `${labels.courseName} (${displayNames[l] ?? l})`),
			...languages.map((l) => `${labels.learningOutcome} (${displayNames[l] ?? l})`),
			labels.elective,
		];
		dataSheet.addRow(headers);
		this.styleHeaderRow(dataSheet, headers);

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { buffer, fileName: labels.templateFileName };
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
		return lang && studyPlansTemplateLabels[lang] ? lang : DEFAULT_TEMPLATE_LANGUAGE;
	}

	private async getLanguages(): Promise<string[]> {
		return (await this.repository.getSupportedLanguages()) ?? DEFAULT_LANGUAGES;
	}

	// Positional layout (header ignored), L = languages.length:
	// studyPlanCode | studyPlanName×L | programCode | level | courseCode | courseName×L | learningOutcome×L | elective
	private parseWorkbook(workbook: ExcelJS.Workbook, languages: string[]): StudyPlanRow[] {
		const worksheet = workbook.worksheets[0];
		const L = languages.length;
		const rows: StudyPlanRow[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			let col = 1;
			const studyPlanCode = this.cell(row, col++);
			const studyPlanName = this.i18nCells(row, col, languages);
			col += L;
			const programCode = this.cell(row, col++);
			const level = this.cell(row, col++);
			const courseCode = this.cell(row, col++);
			const courseName = this.i18nCells(row, col, languages);
			col += L;
			const learningOutcome = this.i18nCells(row, col, languages);
			col += L;
			const isElective = parseElective(this.cell(row, col));

			rows.push({
				rowNumber,
				studyPlanCode,
				studyPlanName,
				programCode,
				level,
				courseCode,
				courseName,
				learningOutcome,
				isElective,
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
		// data columns = 5 single + 3 bilingual groups; error column is the next one.
		const errorColumn = 5 + 3 * languageCount + 1;
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
