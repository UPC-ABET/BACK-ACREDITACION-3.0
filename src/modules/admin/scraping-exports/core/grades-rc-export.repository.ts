import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

import { GradeRcExportRow } from '../model/scraping-exports.types';
import { PROGRAM_CAREER_MAP } from '../model/scraping-exports.transforms';
import {
	DESIGNATED_GRADE_TYPES_SQL,
	ENROLLED_SECTION_STUDENTS_SQL,
	GRADES_RC_TEMP_TABLE,
	INDEX_GRADES_RC_TEMP_SQL,
	MATERIALIZE_GRADES_RC_SQL,
	READ_GRADES_RC_PAGE_SQL,
	UPLOADED_SECTIONS_SQL,
} from './grades-rc-export.sql';
import { EXPORTS_RAW_CONNECTION, resolveAcademicPeriodCode } from './scraping-exports.repository';

export interface DesignatedGradeTypeRow {
	sectionCode: string;
	gradeTypeCode: string;
}

// The two parallel arrays the merge binds, aggregated by the database — see
// ENROLLED_SECTION_STUDENTS_SQL.
export interface EnrolledSectionStudentRow {
	sectionCodes: string[];
	studentCodes: string[];
}

// A reader over the materialized export. `rows()` may be consumed more than once (once per
// worksheet); `close()` drops the scratch table and returns the connection to the pool.
export interface GradesRcExportHandle {
	rows: () => AsyncGenerator<GradeRcExportRow>;
	close: () => Promise<void>;
}

// Rows held in memory at a time. Small enough that the peak no longer scales with the period, large
// enough that a full period is tens of round trips rather than thousands.
const GRADES_RC_PAGE_SIZE = 5000;

/**
 * Builds the RC bulk-upload-ready data out of BOTH scrapings — Banner (raw_notas + raw_horario +
 * raw_matricula) and Planner (raw_planner_nota + raw_planner_seccion + raw_planner_evaluacion) —
 * which live in the same raw DB, so the whole cross runs in one SQL pass. Each source contributes
 * the grades it has; when both hold the same (section, student, grade type) the most recent scrape
 * wins.
 *
 * Reads only. Two things this export deliberately does NOT resolve, because the RC bulk upload
 * (audit.fn_upload_grades_rc) is the one that owns them:
 *  - a non-numeric grade value whose text is not a known TG404 status is passed through as-is
 *    (the upload auto-provisions it);
 *  - a grade type rescued by the last-grade fallback keeps its raw code ("TF1", "NF"), which the
 *    upload rejects until someone registers it in TG205 — see the change runbook. The row still
 *    ships, carrying the observation that says so.
 */
@Injectable()
export class GradesRcExportRepository {
	constructor(
		@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly rawDataSource: DataSource,
		@InjectDataSource() private readonly mainDataSource: DataSource,
	) {}

	/**
	 * Runs the merge into a per-session scratch table and hands back a reader over it. The rows are
	 * never all in memory: `rows()` walks the table a page at a time, and may be walked more than
	 * once — which is what lets the two worksheets be written from one execution of the merge.
	 *
	 * The returned handle OWNS a pooled connection until `close()` is called. Callers must call it in
	 * a `finally`; leaking one leaks a connection for the life of the process.
	 */
	async openGradesRcExport(academicPeriodId: number): Promise<GradesRcExportHandle> {
		const params = await this.buildGradesRcParams(academicPeriodId);

		// One connection for the whole export: a TEMP table lives in the session that created it, and
		// dataSource.query() takes an arbitrary connection from the pool each call, so the create and
		// the reads have to be pinned to the same one.
		const runner = this.rawDataSource.createQueryRunner();
		await runner.connect();

		try {
			// The pooled connection may still carry the table from an export that died before its
			// close(); TEMP tables outlive the request, not the session.
			await runner.query(`DROP TABLE IF EXISTS ${GRADES_RC_TEMP_TABLE}`);
			await runner.query(MATERIALIZE_GRADES_RC_SQL, params);
			await runner.query(INDEX_GRADES_RC_TEMP_SQL);
		} catch (error) {
			await this.closeGradesRcExport(runner);
			throw error;
		}

		return {
			rows: () => this.readGradesRcPages(runner),
			close: () => this.closeGradesRcExport(runner),
		};
	}

	private async *readGradesRcPages(runner: QueryRunner): AsyncGenerator<GradeRcExportRow> {
		let lastSeq = '0';

		for (;;) {
			const page: Array<GradeRcExportRow & { exportSeq: string }> = await runner.query(
				READ_GRADES_RC_PAGE_SQL,
				[lastSeq, GRADES_RC_PAGE_SIZE],
			);
			if (page.length === 0) return;

			for (const row of page) yield row;
			lastSeq = page[page.length - 1].exportSeq;
		}
	}

	// Both halves guarded: a failed DROP must not keep the connection out of the pool, and the
	// release has to happen even then.
	private async closeGradesRcExport(runner: QueryRunner): Promise<void> {
		try {
			await runner.query(`DROP TABLE IF EXISTS ${GRADES_RC_TEMP_TABLE}`);
		} finally {
			await runner.release();
		}
	}

	// Everything the main DB owns, shaped as the parallel arrays the merge binds. Gathered before the
	// scratch table exists so a failure here costs no connection.
	private async buildGradesRcParams(academicPeriodId: number): Promise<unknown[]> {
		const [period, gradeTypes, qualificationStatuses, designated, uploadedSections, enrollments] =
			await Promise.all([
				resolveAcademicPeriodCode(this.mainDataSource, academicPeriodId),
				this.getTypeCodesByName(TYPE_GROUP_CODES.GRADE_TYPE),
				this.getTypeCodesByName(TYPE_GROUP_CODES.QUALIFICATION_STATUS),
				this.getDesignatedGradeTypesBySection(academicPeriodId),
				this.getUploadedSectionCodes(academicPeriodId),
				this.getEnrolledSectionStudents(academicPeriodId),
			]);

		return [
			period,
			[...gradeTypes.keys()],
			[...gradeTypes.values()],
			[...qualificationStatuses.keys()],
			[...qualificationStatuses.values()],
			designated.map((row) => row.sectionCode),
			designated.map((row) => row.gradeTypeCode),
			TYPE_CODES.QUALIFICATION_STATUS.ASISTIO,
			TYPE_CODES.QUALIFICATION_STATUS.SAN,
			uploadedSections,
			TYPE_CODES.QUALIFICATION_STATUS.RET,
			enrollments.sectionCodes,
			enrollments.studentCodes,
			Object.keys(PROGRAM_CAREER_MAP),
			Object.values(PROGRAM_CAREER_MAP),
		];
	}

	// Not a filter either: a row whose (section, student) pair is missing is still exported, and
	// carries an observation saying the upload will reject the file over it. See
	// ENROLLED_SECTION_STUDENTS_SQL.
	async getEnrolledSectionStudents(academicPeriodId: number): Promise<EnrolledSectionStudentRow> {
		const [row]: EnrolledSectionStudentRow[] = await this.mainDataSource.query(
			ENROLLED_SECTION_STUDENTS_SQL,
			[academicPeriodId],
		);
		return row ?? { sectionCodes: [], studentCodes: [] };
	}

	// Not a filter on the export: sections missing here (not uploaded yet, or with no designated
	// type configured) simply behave as "designated type absent", which arms the fallback.
	async getDesignatedGradeTypesBySection(
		academicPeriodId: number,
	): Promise<DesignatedGradeTypeRow[]> {
		return await this.mainDataSource.query(DESIGNATED_GRADE_TYPES_SQL, [academicPeriodId]);
	}

	// Sections the app knows for the period. This is a hard scope, not a partition: the merged CTE
	// filters on it before either worksheet is built, so a grade whose section is not here appears in
	// NEITHER sheet. It is dropped rather than reported because the RC upload rejects the whole file
	// on the first unknown section (sectionNotFound), and a row that cannot be uploaded and cannot be
	// fixed from this file has nothing to say in it. The gap is visible where it can be acted on --
	// the section is missing from academic.course_sections, which is a data-load matter.
	async getUploadedSectionCodes(academicPeriodId: number): Promise<string[]> {
		const rows: Array<{ sectionCode: string }> = await this.mainDataSource.query(
			UPLOADED_SECTIONS_SQL,
			[academicPeriodId],
		);
		return rows.map((row) => row.sectionCode);
	}

	// name (es, uppercased) -> code, for every active type in the given group (main DB).
	async getTypeCodesByName(groupCode: string): Promise<Map<string, string>> {
		const rows: Array<{ code: string; name: string }> = await this.mainDataSource.query(
			`SELECT t.code, UPPER(t.name->>'es') AS name
			 FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1::text AND t.is_active = true`,
			[groupCode],
		);
		return new Map(rows.map((r) => [r.name, r.code]));
	}
}
