import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Writable } from 'stream';

import { JobRegistry } from 'src/modules/survey/shared/core/job-registry';

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
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';

export interface GeneratedExcel {
	buffer: Buffer;
	fileName: string;
}

// maxConcurrent=1 is system-wide, not per-user: more than one merge at a time degrades the shared
// Postgres for every other query, not just this export.
const GRADES_RC_JOB_TTL_MS = 30 * 60 * 1000;
const MAX_CONCURRENT_GRADES_RC_JOBS = 1;
const MAX_CONCURRENT_GRADES_RC_JOBS_PER_USER = 1;
const MAX_RETAINED_GRADES_RC_JOBS = 20;

export type GradesRcExportJobResult = { fileName: string; file: Buffer };

type GradesRcExportJobState = {
	status: 'running' | 'completed' | 'failed';
	result: GradesRcExportJobResult | null;
	errorMessage: string | null;
};

export type GradesRcExportJobStatus = Omit<GradesRcExportJobState, 'result'> & {
	done: boolean;
	fileName: string | null;
};

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
	private readonly logger = new Logger(ScrapingExportsService.name);

	private readonly gradesRcJobs = new JobRegistry<GradesRcExportJobState>({
		ttlMs: GRADES_RC_JOB_TTL_MS,
		maxConcurrent: MAX_CONCURRENT_GRADES_RC_JOBS,
		maxConcurrentPerOwner: MAX_CONCURRENT_GRADES_RC_JOBS_PER_USER,
		maxRetained: MAX_RETAINED_GRADES_RC_JOBS,
	});

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
	// one buffer.
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

	// The merge alone was measured well over ten minutes under real load, past any HTTP gateway's read
	// timeout, so it cannot run inside the request that asks for it: a client that gives up does not
	// cancel the query, and a synchronous handler ends up writing to an already-dead response socket,
	// hanging forever and leaking the connection along with the single-flight guard.
	async startGradesRcExport(
		academicPeriodId: number,
		lang: string | undefined,
		userId: number,
	): Promise<{ accepted: true; jobId: string }> {
		if (!this.gradesRcJobs.hasCapacity(userId)) {
			throw new ConflictException({
				message: scrapingExportsValidationStrings.error.gradesRcInProgress,
			});
		}
		const jobId = this.gradesRcJobs.register(userId, {
			status: 'running',
			result: null,
			errorMessage: null,
		});

		void this.runGradesRcExport(jobId, academicPeriodId, lang);

		return { accepted: true, jobId };
	}

	getGradesRcStatus(jobId: string, userId: number): GradesRcExportJobStatus {
		const status = this.gradesRcJobs.get(jobId, userId);
		if (!status) {
			throw new NotFoundException({
				message: scrapingExportsValidationStrings.error.gradesRcJobNotFound,
			});
		}
		return {
			status: status.status,
			done: status.done,
			fileName: status.result?.fileName ?? null,
			errorMessage: status.errorMessage,
		};
	}

	getGradesRcFile(jobId: string, userId: number): GeneratedExcel {
		const status = this.gradesRcJobs.get(jobId, userId);
		if (!status) {
			throw new NotFoundException({
				message: scrapingExportsValidationStrings.error.gradesRcJobNotFound,
			});
		}
		if (!status.result) {
			throw new NotFoundException({
				message: scrapingExportsValidationStrings.error.gradesRcFileNotReady,
			});
		}
		return { buffer: status.result.file, fileName: status.result.fileName };
	}

	// collectToBuffer only accumulates the serialized xlsx bytes, not the rows -- writeGradesRcSheets
	// still pages the merge out a row at a time, so this does not reintroduce the OOM prepareGradesRc's
	// streaming design avoids.
	private async runGradesRcExport(
		jobId: string,
		academicPeriodId: number,
		lang: string | undefined,
	): Promise<void> {
		try {
			const { fileName, write, close } = await this.prepareGradesRc(academicPeriodId, lang);
			try {
				const file = await this.collectToBuffer(write);
				this.gradesRcJobs.finish(jobId, {
					status: 'completed',
					result: { fileName, file },
					errorMessage: null,
				});
			} finally {
				await close();
			}
		} catch (error) {
			this.logger.error(
				`Grades RC export job ${jobId} failed (period ${academicPeriodId})`,
				error instanceof Error ? error.stack : String(error),
			);
			this.gradesRcJobs.finish(jobId, {
				status: 'failed',
				result: null,
				errorMessage: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private collectToBuffer(write: (out: Writable) => Promise<void>): Promise<Buffer> {
		const chunks: Buffer[] = [];
		const sink = new Writable({
			write(chunk: Buffer, _encoding, callback) {
				chunks.push(chunk);
				callback();
			},
		});
		return write(sink).then(() => Buffer.concat(chunks));
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
		// uploads without a single rejection.
		//
		// The cost is that a row which WOULD upload fine but carries an observation -- a withdrawn
		// student's 0/RET, a genuine unexplained 0 -- is held back with no way through: the upload
		// parses worksheets[0] only, and the review sheet is 16 descriptive columns rather than this
		// 6-column template. Observations that clear once someone fixes the source (a fallback grade,
		// an unregistered type, a missing enrollment) come back in the next download; COURSE_LEVEL_STATUS
		// and ZERO_GRADE_UNEXPLAINED never do, so those enrollments stay out of
		// academic.student_course_grades permanently. ZERO_GRADE_UNEXPLAINED ships ASISTIO, which is
		// the one status the RC semaphore counts -- holding it back moves the RC average.
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
