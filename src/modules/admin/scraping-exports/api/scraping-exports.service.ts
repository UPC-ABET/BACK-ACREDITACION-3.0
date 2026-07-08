import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import { GradesRcExportRepository } from '../core/grades-rc-export.repository';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	ExportLabels,
	alumnoMatriculadoExportLabels,
	alumnoSeccionExportLabels,
	docenteExportLabels,
	gradesRcExportLabels,
	seccionExportLabels,
} from '../model/scraping-exports.labels';
import { GradeRcExportRow } from '../model/scraping-exports.types';
import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

export interface GeneratedExcel {
	buffer: Buffer;
	fileName: string;
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

	async generateGradesRc(academicPeriodId: number | null, lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(gradesRcExportLabels, lang);
		const rows = await this.buildGradesRcRows(academicPeriodId);
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

	// Resolves each raw Banner grade into an RC-upload-ready row:
	//  - gradeTypeCode: matched from the raw "type" (e.g. "EA1") against TG205's short name.
	//    Rows whose type doesn't match any known grade type are skipped -- there is no code to
	//    put in the Excel for them.
	//  - grade / qualificationStatusCode: if the raw grade text parses as a number, it's the grade and
	//    the status is ASISTIO. If it doesn't (Banner returned "SAN"/"RET"/"NR"/etc. as the grade
	//    value itself), the grade defaults to 0 and that raw text is put as-is in the
	//    qualificationStatusCode cell -- if it isn't a known TG404 code/name yet, the RC bulk
	//    upload (fn_upload_grades_rc) is the one that resolves or auto-provisions it, not this
	//    export.
	private async buildGradesRcRows(academicPeriodId: number | null): Promise<GradeRcExportRow[]> {
		const [rawRows, gradeTypeCodesByName, qualificationStatusCodesByName] = await Promise.all([
			this.gradesRcRepository.getRawGradesRc(academicPeriodId),
			this.gradesRcRepository.getTypeCodesByName(TYPE_GROUP_CODES.GRADE_TYPE),
			this.gradesRcRepository.getTypeCodesByName(TYPE_GROUP_CODES.QUALIFICATION_STATUS),
		]);

		const asistioCode = TYPE_CODES.QUALIFICATION_STATUS.ASISTIO;
		const rows: GradeRcExportRow[] = [];

		for (const raw of rawRows) {
			const gradeTypeCode = gradeTypeCodesByName.get((raw.type ?? '').toUpperCase());
			if (!gradeTypeCode) continue;

			const gradeText = (raw.gradeRaw ?? '').trim();
			const parsed = Number(gradeText);
			const isNumeric = gradeText !== '' && !Number.isNaN(parsed);

			const grade = isNumeric ? String(parsed) : '0';
			const qualificationStatusCode = isNumeric
				? asistioCode
				: (qualificationStatusCodesByName.get(gradeText.toUpperCase()) ?? gradeText);

			rows.push({
				sectionCode: raw.sectionCode,
				studentCode: raw.studentCode,
				gradeTypeCode,
				gradeTypePercentage: raw.weight,
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
