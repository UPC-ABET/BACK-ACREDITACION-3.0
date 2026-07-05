import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import { NotasRcExportRepository } from '../core/notas-rc-export.repository';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	ExportLabels,
	alumnoMatriculadoExportLabels,
	alumnoSeccionExportLabels,
	docenteExportLabels,
	notasRcExportLabels,
	seccionExportLabels,
} from '../model/scraping-exports.labels';
import { NotaRcExportRow } from '../model/scraping-exports.types';

export interface GeneratedExcel {
	buffer: Buffer;
	fileName: string;
}

const QUALIFICATION_STATUS_GROUP = 'TG404';
const GRADE_TYPE_GROUP = 'TG205';
const ASISTIO_NAME = 'ASISTIO';

@Injectable()
export class ScrapingExportsService {
	constructor(
		private readonly repository: ScrapingExportsRepository,
		private readonly notasRcRepository: NotasRcExportRepository,
	) {}

	async generateDocentes(lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(docenteExportLabels, lang);
		const rows = await this.repository.getDocentes();
		const data = rows.map((r) => [r.professorCode, r.lastName, r.firstName, r.email]);
		return this.buildExcel(labels, data);
	}

	async generateSecciones(lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(seccionExportLabels, lang);
		const rows = await this.repository.getSecciones();
		const data = rows.map((r) => [
			r.courseCode,
			r.sectionCode,
			r.professorCode,
			r.campusCode,
			r.sectionModalityTypeCode,
		]);
		return this.buildExcel(labels, data);
	}

	async generateAlumnosMatriculados(lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(alumnoMatriculadoExportLabels, lang);
		const rows = await this.repository.getAlumnosMatriculados();
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

	async generateAlumnosSecciones(lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(alumnoSeccionExportLabels, lang);
		const rows = await this.repository.getAlumnosSecciones();
		const data = rows.map((r) => [r.sectionCode, r.studentCode]);
		return this.buildExcel(labels, data);
	}

	async generateNotasRc(lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(notasRcExportLabels, lang);
		const rows = await this.buildNotasRcRows();
		const data = rows.map((r) => [
			r.sectionCode,
			r.studentCode,
			r.gradeTypeCode,
			r.gradeTypePercentage,
			r.grade,
			r.qualificationStatusCode,
		]);
		return this.buildExcel(labels, data);
	}

	// Resolves each raw Banner nota into an RC-upload-ready row:
	//  - gradeTypeCode: matched from the raw "tipo" (e.g. "EA1") against TG205's short name.
	//    Rows whose tipo doesn't match any known grade type are skipped -- there is no code to
	//    put in the Excel for them.
	//  - grade / qualificationStatusCode: if the raw "nota" parses as a number, it's the grade and
	//    the status is ASISTIO. If it doesn't (Banner returned "SAN"/"RET"/"NR"/etc. as the grade
	//    value itself), the grade defaults to 0 and that raw text is put as-is in the
	//    qualificationStatusCode cell -- if it isn't a known TG404 code/name yet, the RC bulk
	//    upload (fn_upload_grades_rc) is the one that resolves or auto-provisions it, not this
	//    export.
	private async buildNotasRcRows(): Promise<NotaRcExportRow[]> {
		const [rawRows, gradeTypeCodesByName, qualificationStatusCodesByName] = await Promise.all([
			this.notasRcRepository.getRawNotasRc(),
			this.notasRcRepository.getTypeCodesByName(GRADE_TYPE_GROUP),
			this.notasRcRepository.getTypeCodesByName(QUALIFICATION_STATUS_GROUP),
		]);

		const asistioCode = qualificationStatusCodesByName.get(ASISTIO_NAME) ?? ASISTIO_NAME;
		const rows: NotaRcExportRow[] = [];

		for (const raw of rawRows) {
			const gradeTypeCode = gradeTypeCodesByName.get((raw.tipo ?? '').toUpperCase());
			if (!gradeTypeCode) continue;

			const notaText = (raw.notaRaw ?? '').trim();
			const parsed = Number(notaText);
			const isNumeric = notaText !== '' && !Number.isNaN(parsed);

			const grade = isNumeric ? String(parsed) : '0';
			const qualificationStatusCode = isNumeric
				? asistioCode
				: (qualificationStatusCodesByName.get(notaText.toUpperCase()) ?? notaText);

			rows.push({
				sectionCode: raw.sectionCode,
				studentCode: raw.studentCode,
				gradeTypeCode,
				gradeTypePercentage: raw.peso,
				grade,
				qualificationStatusCode,
			});
		}

		return rows;
	}

	private resolveLabels(map: Record<string, ExportLabels>, lang?: string): ExportLabels {
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
