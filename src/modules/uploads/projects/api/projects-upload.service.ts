import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { readCell } from 'src/libs/excel.functions';

import { ProjectRow, UploadResult, UploadRowError } from '../model/projects-upload.types';
import type { ProjectsUploadDto } from '../model/projects-upload.dtos';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	projectsErrorMessages,
	projectsTemplateLabels,
} from '../model/projects-template.labels';
import { ProjectsUploadRepository } from '../core/projects-upload.repository';
import { UploadLogService } from '../../upload-logs/api/upload-logs.service';

@Injectable()
export class ProjectsUploadService {
	constructor(
		private readonly repository: ProjectsUploadRepository,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(
		fileBuffer: Buffer,
		fileName: string,
		userId: number,
		academicPeriodId: number,
		dto: ProjectsUploadDto,
	): Promise<UploadResult> {
		await this.uploadLogService.assertAcademicPeriodExists(academicPeriodId);

		const language = this.resolveLanguage(dto.lang);
		const labels = projectsTemplateLabels[language];
		const messages = projectsErrorMessages[language];

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
		const labels = projectsTemplateLabels[language];

		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Template');

		const headers = [
			labels.projectCode,
			labels.projectNameEs,
			labels.projectNameEn,
			labels.courseCode,
			labels.studentCode,
			labels.sectionCode,
			labels.professorCode,
			labels.evaluatorTypeCode,
		];

		sheet.addRow(headers);
		this.styleHeaderRow(sheet, headers);

		// Example row
		sheet.addRow([
			'TFG-001',
			'Mi tesis de grado',
			'My undergraduate thesis',
			'CS101',
			'STU001',
			'SEC-001',
			'PROF001',
			'TG403-T001',
		]);

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { buffer, fileName: labels.templateFileName };
	}

	// Positional layout (header row ignored):
	// projectCode | projectNameEs | projectNameEn | courseCode |
	// studentCode | sectionCode | professorCode | evaluatorTypeCode
	private parseWorkbook(workbook: ExcelJS.Workbook): ProjectRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: ProjectRow[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				projectCode: readCell(row, 1),
				projectNameEs: readCell(row, 2),
				projectNameEn: readCell(row, 3),
				courseCode: readCell(row, 4),
				studentCode: readCell(row, 5),
				sectionCode: readCell(row, 6),
				professorCode: readCell(row, 7),
				evaluatorTypeCode: readCell(row, 8),
			});
		});

		return rows;
	}

	private styleHeaderRow(sheet: ExcelJS.Worksheet, headers: string[], rowNumber = 1): void {
		const row = sheet.getRow(rowNumber);
		row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		row.eachCell((cell, colNumber) => {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
			sheet.getColumn(colNumber).width = headers[colNumber - 1].length + 4;
		});
	}

	private resolveLanguage(lang?: string): string {
		return lang && projectsTemplateLabels[lang] ? lang : DEFAULT_TEMPLATE_LANGUAGE;
	}

	private async annotateErrors(
		workbook: ExcelJS.Workbook,
		errors: UploadRowError[],
		errorColumnHeader: string,
		messages: Record<string, string>,
	): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 9; // after the 8 data columns
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
