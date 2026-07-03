import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { readCell } from 'src/libs/excel.functions';

import { GradesRvRow, UploadResult, UploadRowError } from '../model/grades-rv-upload.types';
import type { GradesRvUploadDto } from '../model/grades-rv-upload.dtos';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	gradesRvErrorMessages,
	gradesRvFieldInstructions,
	gradesRvTemplateLabels,
} from '../model/grades-rv-template.labels';
import { gradeTypesList } from '../../rubrics/model/rubrics-template.labels';
import { GradesRvUploadRepository } from '../core/grades-rv-upload.repository';
import { UploadLogService } from '../../upload-logs/api/upload-logs.service';

// Positional column layout:
//  1: ESCUELA   2: CARRERA   3: COMISION   4: CURSO    5: ALUMNO    6: SECCION
//  7: DOCENTE   8: TIPOEVALUACION  9-15: O1-O7
// 16: CODIGOPROYECTO  17: PROYECTO(ES)  18: PROYECTO(EN)  19: DESCPROYECTO(ES)  20: DESCPROYECTO(EN)
const ERROR_COLUMN = 21;

@Injectable()
export class GradesRvUploadService {
	constructor(
		private readonly repository: GradesRvUploadRepository,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(
		fileBuffer: Buffer,
		fileName: string,
		userId: number,
		academicPeriodId: number,
		dto: GradesRvUploadDto,
	): Promise<UploadResult> {
		await this.uploadLogService.assertAcademicPeriodExists(academicPeriodId);

		const language = this.resolveLanguage(dto.lang);
		const labels = gradesRvTemplateLabels[language];
		const messages = gradesRvErrorMessages[language];

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
		const labels = gradesRvTemplateLabels[language];
		const instructions = gradesRvFieldInstructions[language];

		const workbook = new ExcelJS.Workbook();
		const dataSheet = workbook.addWorksheet('Template');

		const headers = [
			labels.escuelaCode,
			labels.carreraCode,
			labels.commissionCode,
			labels.courseCode,
			labels.studentCode,
			labels.sectionCode,
			labels.professorCode,
			labels.gradeTypeCode,
			'O1',
			'O2',
			'O3',
			'O4',
			'O5',
			'O6',
			'O7',
			labels.projectCode,
			labels.projectNameEs,
			labels.projectNameEn,
			labels.projectDescEs,
			labels.projectDescEn,
		];

		dataSheet.addRow(headers);
		this.styleHeaderRow(dataSheet, headers);

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
		instrSheet.getColumn(2).width = 65;
		instrSheet.getColumn(3).width = 13;
		instrSheet.getColumn(4).width = 25;

		// ── Grade types reference (below instructions) ────────────────────
		const gtStartRow = 2 + instructions.length + 2;

		const gtTitleRow = instrSheet.getRow(gtStartRow);
		const gtTitleCell = gtTitleRow.getCell(1);
		gtTitleCell.value = labels.gradeTypesTitle;
		gtTitleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
		gtTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
		gtTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
		instrSheet.mergeCells(gtStartRow, 1, gtStartRow, 2);
		gtTitleRow.height = 22;

		const gtSubRow = instrSheet.getRow(gtStartRow + 1);
		[labels.gradeTypesColCode, labels.gradeTypesColName].forEach((h, i) => {
			const cell = gtSubRow.getCell(i + 1);
			cell.value = h;
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
			cell.alignment = { horizontal: 'center', vertical: 'middle' };
		});

		gradeTypesList.forEach((gt, idx) => {
			const r = instrSheet.getRow(gtStartRow + 2 + idx);
			r.getCell(1).value = gt.code;
			r.getCell(2).value = gt.name;
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

	private styleHeaderRow(sheet: ExcelJS.Worksheet, headers: string[], rowNumber = 1): void {
		const row = sheet.getRow(rowNumber);
		row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		row.eachCell((cell, colNumber) => {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
			sheet.getColumn(colNumber).width = Math.max((headers[colNumber - 1] ?? '').length + 2, 10);
		});
	}

	private resolveLanguage(lang?: string): string {
		return lang && gradesRvTemplateLabels[lang] ? lang : DEFAULT_TEMPLATE_LANGUAGE;
	}

	private parseWorkbook(workbook: ExcelJS.Workbook): GradesRvRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: GradesRvRow[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				escuelaCode: readCell(row, 1),
				carreraCode: readCell(row, 2),
				commissionCode: readCell(row, 3),
				courseCode: readCell(row, 4),
				studentCode: readCell(row, 5),
				sectionCode: readCell(row, 6),
				professorCode: readCell(row, 7),
				gradeTypeCode: readCell(row, 8),
				o1: readCell(row, 9),
				o2: readCell(row, 10),
				o3: readCell(row, 11),
				o4: readCell(row, 12),
				o5: readCell(row, 13),
				o6: readCell(row, 14),
				o7: readCell(row, 15),
				projectCode: readCell(row, 16),
				projectNameEs: readCell(row, 17),
				projectNameEn: readCell(row, 18),
				projectDescEs: readCell(row, 19),
				projectDescEn: readCell(row, 20),
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
