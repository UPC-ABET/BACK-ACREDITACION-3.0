import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Writable } from 'stream';

import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import { GradesRcExportRepository } from '../core/grades-rc-export.repository';
import {
	EnrolledStudentExportRow,
	GradeRcExportRow,
	SectionExportRow,
	StaffExportRow,
	StudentSectionExportRow,
} from '../model/scraping-exports.types';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	ExportLabels,
	enrolledStudentExportLabels,
	gradesRcDescriptiveLabels,
	gradesRcExportLabels,
	sectionExportLabels,
	staffExportLabels,
	studentSectionExportLabels,
} from '../model/scraping-exports.labels';

export interface GeneratedExcel {
	buffer: Buffer;
	fileName: string;
}

@Injectable()
export class ScrapingExportsService {
	private readonly logger = new Logger(ScrapingExportsService.name);

	constructor(
		private readonly repository: ScrapingExportsRepository,
		private readonly gradesRcRepository: GradesRcExportRepository,
	) {}

	// %% SYNC EXPORTS — fetch is language-neutral (called once per generation); render applies
	// labels for a requested language (called once per download). Splitting these is what lets
	// generation persist `rowsData` once and download render it for any supported language without
	// re-querying the raw datasource.

	async fetchStaffRows(academicPeriodId: number | null): Promise<StaffExportRow[]> {
		return await this.repository.getStaff(academicPeriodId);
	}

	renderStaffExcel(rows: StaffExportRow[], lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(staffExportLabels, lang);
		const data = rows.map((r) => [r.professorCode, r.lastName, r.firstName, r.email]);
		return this.buildExcel(labels, data);
	}

	async fetchSectionRows(academicPeriodId: number | null): Promise<SectionExportRow[]> {
		return await this.repository.getSections(academicPeriodId);
	}

	renderSectionsExcel(rows: SectionExportRow[], lang?: string): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(sectionExportLabels, lang);
		const data = rows.map((r) => [
			r.courseCode,
			r.sectionCode,
			r.professorCode,
			r.campusCode,
			r.sectionModalityTypeCode,
		]);
		return this.buildExcel(labels, data);
	}

	async fetchEnrolledStudentRows(
		academicPeriodId: number | null,
	): Promise<EnrolledStudentExportRow[]> {
		return await this.repository.getEnrolledStudents(academicPeriodId);
	}

	renderEnrolledStudentsExcel(
		rows: EnrolledStudentExportRow[],
		lang?: string,
	): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(enrolledStudentExportLabels, lang);
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

	async fetchStudentSectionRows(
		academicPeriodId: number | null,
	): Promise<StudentSectionExportRow[]> {
		return await this.repository.getStudentSections(academicPeriodId);
	}

	renderStudentSectionsExcel(
		rows: StudentSectionExportRow[],
		lang?: string,
	): Promise<GeneratedExcel> {
		const labels = this.resolveLabels(studentSectionExportLabels, lang);
		const data = rows.map((r) => [r.sectionCode, r.studentCode]);
		return this.buildExcel(labels, data);
	}

	// %% GRADES RC — fetch runs the Planner-sourced merge once (see ADR-005) and collects it,
	// language-neutral, into one array (the same shape the sync exports' fetch* methods already
	// produce, persisted through `rowsData` — see ADR-004); render splits that array by
	// `hasObservations` and writes both sheets. Fetch is the only caller of
	// GradesRcExportRepository (the `exports-raw` connection).

	async fetchGradesRcRows(
		academicPeriodId: number,
	): Promise<Array<GradeRcExportRow & { hasObservations: boolean }>> {
		const handle = await this.gradesRcRepository.openGradesRcExport(academicPeriodId);
		try {
			const rows: Array<GradeRcExportRow & { hasObservations: boolean }> = [];
			for await (const row of handle.rows()) rows.push(row);
			return rows;
		} finally {
			await handle.close();
		}
	}

	async renderGradesRc(
		rows: Array<GradeRcExportRow & { hasObservations: boolean }>,
		lang?: string,
	): Promise<GeneratedExcel> {
		const chunks: Buffer[] = [];
		const sink = new Writable({
			write(chunk: Buffer, _encoding, callback) {
				chunks.push(chunk);
				callback();
			},
		});

		const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sink, useStyles: true });
		const labels = this.resolveLabels(gradesRcExportLabels, lang);
		this.writeGradesRcSheets(workbook, rows, labels, lang);
		await workbook.commit();

		return { buffer: Buffer.concat(chunks), fileName: labels.fileName };
	}

	private writeGradesRcSheets(
		workbook: ExcelJS.stream.xlsx.WorkbookWriter,
		rows: Array<GradeRcExportRow & { hasObservations: boolean }>,
		labels: ExportLabels,
		lang: string | undefined,
	): void {
		// Sheet order is load-bearing: the upload parses worksheets[0], and the writer streams sheets
		// in creation order.
		//
		// The cost of holding back a row that carries an observation -- COURSE_LEVEL_STATUS and
		// ZERO_GRADE_UNEXPLAINED never clear on their own, so those enrollments stay out of
		// academic.student_course_grades permanently, and ZERO_GRADE_UNEXPLAINED ships ASISTIO (the
		// status the RC semaphore counts) -- is unchanged from the prior design; see git history for
		// the full reasoning if this sheet split is ever revisited.
		const uploadSheet = this.startSheet(workbook, 'Data', labels.headers);

		const descriptive = this.resolveLabels(gradesRcDescriptiveLabels, lang);
		// The observations are full sentences, so the last column gets room for one.
		const detailSheet = this.startSheet(workbook, descriptive.sheetName, descriptive.headers, {
			[descriptive.headers.length]: 90,
		});

		// One pass, not two: `rows` is a fully in-memory array now (see ADR-004), so there is no
		// separate paginated query per sheet to justify a second full iteration.
		for (const r of rows) {
			if (r.hasObservations) {
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
						(r.observations ?? [])
							.map((code) => descriptive.observations[code] ?? code)
							.join(' | '),
					])
					.commit();
			} else {
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
		}
		uploadSheet.commit();
		detailSheet.commit();
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
