import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { readCell } from 'src/libs/excel.functions';

import { GradesRcRow, UploadResult, UploadRowError } from '../model/grades-rc-upload.types';
import type { GradesRcUploadDto } from '../model/grades-rc-upload.dtos';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	gradesRcErrorMessages,
	gradesRcTemplateLabels,
} from '../model/grades-rc-template.labels';
import { GradesRcUploadRepository } from '../core/grades-rc-upload.repository';
import { UploadLogService } from '../../upload-logs/api/upload-logs.service';

@Injectable()
export class GradesRcUploadService {
	constructor(
		private readonly repository: GradesRcUploadRepository,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(
		fileBuffer: Buffer,
		fileName: string,
		userId: number,
		academicPeriodId: number,
		dto: GradesRcUploadDto,
	): Promise<UploadResult> {
		await this.uploadLogService.assertAcademicPeriodExists(academicPeriodId);

		const language = this.resolveLanguage(dto.lang);
		const labels = gradesRcTemplateLabels[language];
		const messages = gradesRcErrorMessages[language];

		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const result = await this.repository.callUploadFunction(
			rows,
			academicPeriodId,
			userId,
			fileName,
		);

		const errors: UploadRowError[] = result
			.filter((r) => r.error_code !== null)
			.map((r) => ({ rowNumber: r.row_number as number, errorCode: r.error_code as string }));

		if (errors.length > 0) {
			const excel = await this.annotateErrors(workbook, errors, labels.errorColumn, messages);
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
		const labels = gradesRcTemplateLabels[language];
		const gradeTypes = await this.repository.getGradeTypes(language);

		const workbook = new ExcelJS.Workbook();

		const dataSheet = workbook.addWorksheet('Template');
		const headers = [
			labels.sectionCode,
			labels.studentCode,
			labels.gradeTypeCode,
			labels.gradeTypePercentage,
			labels.grade,
		];
		dataSheet.addRow(headers);
		this.styleHeaderRow(dataSheet, headers);

		const legendSheet = workbook.addWorksheet(labels.legendSheet);
		const legendHeaders = [labels.legendCode, labels.legendName];
		legendSheet.addRow(legendHeaders);
		this.styleHeaderRow(legendSheet, legendHeaders);
		for (const gradeType of gradeTypes) {
			legendSheet.addRow([gradeType.code, gradeType.name]);
		}

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
		return lang && gradesRcTemplateLabels[lang] ? lang : DEFAULT_TEMPLATE_LANGUAGE;
	}

	// Positional layout (header ignored):
	// sectionCode | studentCode | gradeTypeCode | gradeTypePercentage | grade
	private parseWorkbook(workbook: ExcelJS.Workbook): GradesRcRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: GradesRcRow[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				sectionCode: readCell(row, 1),
				studentCode: readCell(row, 2),
				gradeTypeCode: readCell(row, 3),
				gradeTypePercentage: readCell(row, 4),
				grade: readCell(row, 5),
			});
		});
		return rows;
	}

	private async annotateErrors(
		workbook: ExcelJS.Workbook,
		errors: UploadRowError[],
		errorColumnHeader: string,
		messages: Record<string, string>,
	): Promise<string> {
		const worksheet = workbook.worksheets[0];
		// data columns = sectionCode, studentCode, gradeTypeCode, gradeTypePercentage, grade; error column is next.
		const errorColumn = 6;
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
