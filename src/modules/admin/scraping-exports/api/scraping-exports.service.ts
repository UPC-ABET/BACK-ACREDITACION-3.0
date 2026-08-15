import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { Writable } from 'stream';

import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import {
	GradesRcExportHandle,
	GradesRcExportRepository,
} from '../core/grades-rc-export.repository';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	ExportLabels,
	alumnoMatriculadoExportLabels,
	alumnoSeccionExportLabels,
	docenteExportLabels,
	gradesRcDescriptiveLabels,
	gradesRcExportLabels,
	seccionExportLabels,
} from '../model/scraping-exports.labels';

export interface GeneratedExcel {
	buffer: Buffer;
	fileName: string;
}

// An export too large to hold in memory: the file is written into the caller's stream instead of
// being handed over as a Buffer. `write` resolves once the workbook is fully committed, and the
// rows behind it are already loaded by the time this object exists.
export interface StreamedExcel {
	fileName: string;
	write: (out: Writable) => Promise<void>;
	// Releases the pooled connection and the scratch table behind `write`. Must be called in a
	// `finally` by whoever asked for the export, including when `write` was never reached.
	close: () => Promise<void>;
}

@Injectable()
export class ScrapingExportsService {
	constructor(
		private readonly repository: ScrapingExportsRepository,
		private readonly gradesRcRepository: GradesRcExportRepository,
	) {}

	async generateDocentes(academicPeriodId: number | null, lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(docenteExportLabels, lang);
		const rows = await this.repository.getDocentes(academicPeriodId);
		const data = rows.map((r) => [r.professorCode, r.lastName, r.firstName, r.email]);
		return this.buildExcel(labels, data);
	}

	async generateSecciones(academicPeriodId: number | null, lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(seccionExportLabels, lang);
		const rows = await this.repository.getSecciones(academicPeriodId);
		const data = rows.map((r) => [
			r.courseCode,
			r.sectionCode,
			r.professorCode,
			r.campusCode,
			r.sectionModalityTypeCode,
		]);
		return this.buildExcel(labels, data);
	}

	async generateAlumnosMatriculados(
		academicPeriodId: number | null,
		lang?: string,
	): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(alumnoMatriculadoExportLabels, lang);
		const rows = await this.repository.getAlumnosMatriculados(academicPeriodId);
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

	async generateAlumnosSecciones(
		academicPeriodId: number | null,
		lang?: string,
	): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(alumnoSeccionExportLabels, lang);
		const rows = await this.repository.getAlumnosSecciones(academicPeriodId);
		const data = rows.map((r) => [r.sectionCode, r.studentCode]);
		return this.buildExcel(labels, data);
	}

	// Nothing here is ever held whole: buildExcel's three copies of the dataset (row array, sheet
	// model, xlsx Buffer) OOM-crashed the process on a real period. The rows page out of a scratch
	// table and WorkbookWriter drops each one on commit, so the peak is a page rather than a period.
	//
	// Returns a writer over any Writable instead of a GeneratedExcel because the file never exists as
	// one buffer. The merge has already run once this resolves, which lets the controller send its
	// headers only after the query succeeded.
	async prepareGradesRc(academicPeriodId: number, lang?: string): Promise<StreamedExcel> {
		const labels = this.resolveLabels(gradesRcExportLabels, lang);
		const handle = await this.gradesRcRepository.openGradesRcExport(academicPeriodId);

		return {
			fileName: labels.fileName,
			close: () => handle.close(),
			write: async (out: Writable) => {
				const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: true });
				await this.writeGradesRcSheets(workbook, handle, labels, lang);
			},
		};
	}

	private async writeGradesRcSheets(
		workbook: ExcelJS.stream.xlsx.WorkbookWriter,
		handle: GradesRcExportHandle,
		labels: ExportLabels,
		lang: string | undefined,
	): Promise<void> {
		// Sheet order is load-bearing: the upload parses worksheets[0], and the writer streams sheets
		// in creation order.
		//
		// The two are disjoint halves split on whether the row carries an observation, so this one
		// uploads without a single rejection. A row that WOULD upload fine but carries one -- a
		// withdrawn student's 0/RET, a fallback grade -- is not here either; it ships from the review
		// sheet once someone confirms it.
		const uploadSheet = this.startSheet(workbook, 'Data', labels.headers);
		for await (const r of handle.rows(false)) {
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
		// Re-read rather than keeping the first pass's rows: that is what holds the peak at one page.
		for await (const r of handle.rows(true)) {
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
