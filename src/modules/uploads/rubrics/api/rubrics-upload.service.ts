import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { readCell } from 'src/libs/excel.functions';

import { RubricRow, UploadResult, UploadRowError } from '../model/rubrics-upload.types';
import type { RubricsUploadDto } from '../model/rubrics-upload.dtos';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	gradeTypesList,
	rubricsFieldInstructions,
	rubricsTemplateLabels,
} from '../model/rubrics-template.labels';
import { RubricsUploadRepository } from '../core/rubrics-upload.repository';
import { UploadLogService } from '../../upload-logs/api/upload-logs.service';

@Injectable()
export class RubricsUploadService {
	constructor(
		private readonly repository: RubricsUploadRepository,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(
		fileBuffer: Buffer,
		fileName: string,
		userId: number,
		academicPeriodId: number,
		dto: RubricsUploadDto,
	): Promise<UploadResult> {
		await this.uploadLogService.assertAcademicPeriodExists(academicPeriodId);

		const language = this.resolveLanguage(dto.lang);
		const labels = rubricsTemplateLabels[language];
		const messages = rubricsErrorMessages[language];

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
		const labels = rubricsTemplateLabels[language];
		const instructions = rubricsFieldInstructions[language];

		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Template');

		// ── Data table (cols 1-9) ─────────────────────────────────────────
		const headers = [
			labels.courseCode,
			labels.gradeTypeCode,
			labels.outcomeCode,
			labels.questionEs,
			labels.questionEn,
			labels.criteriaEs,
			labels.criteriaEn,
			labels.minValue,
			labels.maxValue,
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
		instrSheet.getColumn(2).width = 65;
		instrSheet.getColumn(3).width = 13;
		instrSheet.getColumn(4).width = 25;

		// ── Grade types table ─────────────────────────────────────────────
		const evalStartRow = 2 + instructions.length + 2;

		const evalTitleRow = instrSheet.getRow(evalStartRow);
		const evalTitleCell = evalTitleRow.getCell(1);
		evalTitleCell.value = labels.gradeTypesTitle;
		evalTitleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
		evalTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
		evalTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
		instrSheet.mergeCells(evalStartRow, 1, evalStartRow, 2);
		evalTitleRow.height = 22;

		const evalSubRow = instrSheet.getRow(evalStartRow + 1);
		[labels.gradeTypesColCode, labels.gradeTypesColName].forEach((h, i) => {
			const cell = evalSubRow.getCell(i + 1);
			cell.value = h;
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
			cell.alignment = { horizontal: 'center', vertical: 'middle' };
		});

		gradeTypesList.forEach((gt, idx) => {
			const r = instrSheet.getRow(evalStartRow + 2 + idx);
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

	// Positional layout (header row ignored):
	// courseCode | gradeTypeCode | outcomeCode | questionEs | questionEn |
	// criteriaEs | criteriaEn | minValue | maxValue
	private parseWorkbook(workbook: ExcelJS.Workbook): RubricRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: RubricRow[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				courseCode: readCell(row, 1),
				gradeTypeCode: readCell(row, 2),
				outcomeCode: readCell(row, 3),
				questionEs: readCell(row, 4),
				questionEn: readCell(row, 5),
				criteriaEs: readCell(row, 6),
				criteriaEn: readCell(row, 7),
				minValue: readCell(row, 8),
				maxValue: readCell(row, 9),
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
		return lang && rubricsTemplateLabels[lang] ? lang : DEFAULT_TEMPLATE_LANGUAGE;
	}

	private async annotateErrors(
		workbook: ExcelJS.Workbook,
		errors: UploadRowError[],
		errorColumnHeader: string,
		messages: Record<string, string>,
	): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 10; // after the 9 data columns
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

const rubricsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		courseCodeEmpty: 'El código del curso es obligatorio.',
		gradeTypeCodeEmpty: 'El código de tipo de calificación es obligatorio.',
		criteriaEsEmpty: 'El criterio en español es obligatorio.',
		criteriaEnEmpty: 'El criterio en inglés es obligatorio.',
		minValueInvalid: 'El puntaje mínimo debe ser un número válido.',
		maxValueInvalid: 'El puntaje máximo debe ser un número válido.',
		minValueGreaterThanMax: 'El puntaje mínimo no puede ser mayor que el puntaje máximo.',
		questionRequiredNonCapstone:
			'La pregunta en español es obligatoria para rúbricas no-Capstone+EB.',
		outcomeRequiredCapstoneEb:
			'El código de outcome es obligatorio para rúbricas Capstone con tipo EB.',
		courseNotFound: 'No existe un curso con ese código en el periodo académico.',
		gradeTypeNotFound: 'El código de tipo de calificación no es válido.',
		rubricAlreadyExists:
			'Ya existe una rúbrica activa para ese curso y tipo de calificación en el periodo.',
		outcomeNotFound: 'No existe un outcome con ese código mapeado al curso.',
		criteriaOverlap: 'Los criterios de la pregunta se solapan o no son consecutivos.',
		criteriaTotalNot20: 'La suma de los puntajes máximos por pregunta debe ser 20.',
	},
	en: {
		courseCodeEmpty: 'Course code is required.',
		gradeTypeCodeEmpty: 'Grade type code is required.',
		criteriaEsEmpty: 'Criteria in Spanish is required.',
		criteriaEnEmpty: 'Criteria in English is required.',
		minValueInvalid: 'Min score must be a valid number.',
		maxValueInvalid: 'Max score must be a valid number.',
		minValueGreaterThanMax: 'Min score cannot be greater than max score.',
		questionRequiredNonCapstone: 'Question in Spanish is required for non-Capstone+EB rubrics.',
		outcomeRequiredCapstoneEb: 'Outcome code is required for Capstone rubrics with grade type EB.',
		courseNotFound: 'No course with that code exists in the academic period.',
		gradeTypeNotFound: 'Grade type code is not valid.',
		rubricAlreadyExists:
			'An active rubric already exists for that course and grade type in the period.',
		outcomeNotFound: 'No outcome with that code is mapped to the course.',
		criteriaOverlap: 'The criteria for the question overlap or are not consecutive.',
		criteriaTotalNot20: 'The sum of max scores per question must equal 20.',
	},
};
