import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { readCell } from 'src/libs/excel.functions';

import { ProjectRow, UploadResult, UploadRowError } from '../model/projects-upload.types';
import type { ProjectsUploadDto } from '../model/projects-upload.dtos';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	evaluatorTypesList,
	projectsErrorMessages,
	projectsFieldInstructions,
	projectsTemplateLabels,
} from '../model/projects-template.labels';
import { ProjectsUploadRepository } from '../core/projects-upload.repository';
import { UploadLogService } from '../../upload-logs/api/upload-logs.service';

// Columns: projectCode(1) projectNameEs(2) projectNameEn(3) courseCode(4)
//          studentCode(5) sectionCode(6) + one column per evaluator type starting at 7
const FIXED_COLUMNS = 6;
const ERROR_COLUMN = FIXED_COLUMNS + evaluatorTypesList.length + 1;

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
		const instructions = projectsFieldInstructions[language];

		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Template');

		// ── Data table ────────────────────────────────────────────────────────
		const evaluatorHeaders = evaluatorTypesList.map((et) => {
			const [nameEs, nameEn] = et.name.split(' / ');
			const name = language === 'es' ? nameEs : nameEn;
			return `${name} (${et.code})`;
		});

		const headers = [
			labels.projectCode,
			labels.projectNameEs,
			labels.projectNameEn,
			labels.courseCode,
			labels.studentCode,
			labels.sectionCode,
			...evaluatorHeaders,
		];

		sheet.addRow(headers);
		this.styleHeaderRow(sheet, headers);

		// ── Instructions sheet ────────────────────────────────────────────
		const instrSheet = workbook.addWorksheet(labels.instructionsTitle);

		const instHeaders = [
			labels.instructionsColField,
			labels.instructionsColDescription,
			labels.instructionsColRequired,
			labels.instructionsColExample,
		];

		const instHeaderRow = instrSheet.getRow(1);
		instHeaders.forEach((h, i) => {
			const cell = instHeaderRow.getCell(i + 1);
			cell.value = h;
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
			cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
		});
		instHeaderRow.height = 22;

		instructions.forEach((instr, idx) => {
			const r = instrSheet.getRow(2 + idx);
			r.getCell(1).value = instr.field;
			r.getCell(2).value = instr.description;
			r.getCell(3).value = instr.required ? labels.instructionsYes : labels.instructionsNo;
			r.getCell(4).value = instr.example;

			for (let c = 1; c <= 4; c++) {
				const cell = r.getCell(c);
				cell.alignment = { vertical: 'middle', wrapText: true };
				cell.border = {
					bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
					right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
				};
			}
			r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
			r.height = 40;
		});

		instrSheet.getColumn(1).width = 30;
		instrSheet.getColumn(2).width = 60;
		instrSheet.getColumn(3).width = 13;
		instrSheet.getColumn(4).width = 25;

		// ── Evaluator types reference (below instructions) ────────────────
		const evalStartRow = 2 + instructions.length + 2;

		const evalTitleRow = instrSheet.getRow(evalStartRow);
		const evalTitleCell = evalTitleRow.getCell(1);
		evalTitleCell.value = labels.evaluatorTypesTitle;
		evalTitleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
		evalTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
		evalTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
		instrSheet.mergeCells(evalStartRow, 1, evalStartRow, 2);
		evalTitleRow.height = 22;

		const evalSubRow = instrSheet.getRow(evalStartRow + 1);
		[labels.evaluatorTypesColCode, labels.evaluatorTypesColName].forEach((h, i) => {
			const cell = evalSubRow.getCell(i + 1);
			cell.value = h;
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
			cell.alignment = { horizontal: 'center', vertical: 'middle' };
		});

		evaluatorTypesList.forEach((et, idx) => {
			const r = instrSheet.getRow(evalStartRow + 2 + idx);
			r.getCell(1).value = et.code;
			r.getCell(2).value = et.name;
			[1, 2].forEach((c) => {
				const cell = r.getCell(c);
				cell.alignment = { vertical: 'middle' };
				cell.border = {
					bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
					right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
				};
			});
		});

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { buffer, fileName: labels.templateFileName };
	}

	// Positional layout (header row ignored):
	// projectCode(1) | projectNameEs(2) | projectNameEn(3) | courseCode(4) |
	// studentCode(5) | sectionCode(6) | [evaluatorType cols 7..N]
	private parseWorkbook(workbook: ExcelJS.Workbook): ProjectRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: ProjectRow[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;

			const evaluators: Record<string, string> = {};
			evaluatorTypesList.forEach((et, idx) => {
				evaluators[et.code] = readCell(row, FIXED_COLUMNS + 1 + idx);
			});

			rows.push({
				rowNumber,
				projectCode: readCell(row, 1),
				projectNameEs: readCell(row, 2),
				projectNameEn: readCell(row, 3),
				courseCode: readCell(row, 4),
				studentCode: readCell(row, 5),
				sectionCode: readCell(row, 6),
				evaluators,
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
		const headerCell = worksheet.getRow(1).getCell(ERROR_COLUMN);
		headerCell.value = errorColumnHeader;
		headerCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
		worksheet.getColumn(ERROR_COLUMN).width = errorColumnHeader.length + 2;

		const byRow = new Map<number, string[]>();
		for (const e of errors) {
			const list = byRow.get(e.rowNumber) ?? [];
			list.push(messages[e.errorCode] ?? e.errorCode);
			byRow.set(e.rowNumber, list);
		}
		for (const [rowNumber, texts] of byRow) {
			worksheet.getRow(rowNumber).getCell(ERROR_COLUMN).value = texts.join(' | ');
		}

		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
