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

	// Nothing here is ever held whole. buildExcel kept three full copies of the dataset at once (row
	// array, ExcelJS sheet model, final xlsx Buffer) and OOM-crashed the process on a real period, in
	// an API capped at 640 MB. Now the rows live in a scratch table in the database and arrive a page
	// at a time, and WorkbookWriter discards each row as soon as it is committed to the stream, so
	// the peak is one page rather than one period.
	//
	// The other exports return a GeneratedExcel and let the controller do the transport; this one
	// cannot, since the point is that the file never exists as one buffer. So it returns the file
	// name plus a writer over any Writable: the merge has already run by the time this resolves,
	// which is what lets the controller send its headers only once the query has succeeded, and HTTP
	// stays in the controller.
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
		// Sheet order is load-bearing: the RC bulk upload parses worksheets[0] positionally, so the
		// upload-shaped sheet must stay first and the descriptive one must come after. The writer
		// streams sheets in creation order and a committed sheet cannot be reopened.
		// Both sheets describe the same rows; the query already scoped them to sections the app knows.
		const uploadSheet = this.startSheet(workbook, 'Data', labels.headers);
		for await (const r of handle.rows()) {
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
		// The observations are full sentences addressed to whoever reviews the file, so the last
		// column is given room to hold one instead of the header-sized width the others get.
		const detailSheet = this.startSheet(workbook, descriptive.sheetName, descriptive.headers, {
			[descriptive.headers.length]: 90,
		});
		// The scratch table is read a second time rather than the rows being kept from the first pass:
		// re-reading is what keeps the peak at one page.
		for await (const r of handle.rows()) {
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

	// Same red bold header as buildExcel, against the streaming writer. Column widths have to be set
	// before the first commit -- the writer seals the sheet's metadata once rows start flowing.
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
