import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

import { GRADES_RC_PAGE_SIZE, GradeRcExportRow } from '../model/scraping-exports.types';
import { PROGRAM_CAREER_MAP } from '../model/scraping-exports.transforms';
import {
	CONTROL_OUTCOME_SECTIONS_SQL,
	DESIGNATED_GRADE_TYPES_SQL,
	DROP_NOT_IN_SECTION_COLUMN_SQL,
	ENROLLED_SECTION_STUDENTS_SQL,
	GRADES_RC_TEMP_TABLE,
	INDEX_GRADES_RC_TEMP_SQL,
	MATERIALIZE_GRADES_RC_SQL,
	NOT_IN_SECTION_CANDIDATES_SQL,
	PERIOD_ENROLLED_STUDENTS_SQL,
	PRUNE_GRADES_RC_UNRESOLVED_SQL,
	READ_GRADES_RC_ALL_PAGE_SQL,
	STUDY_PLAN_MEMBERSHIP_FOR_PAIRS_SQL,
	UPLOADED_SECTIONS_SQL,
} from './grades-rc-export.sql';
import { EXPORTS_RAW_CONNECTION, resolveAcademicPeriodCode } from './scraping-exports.repository';

export interface DesignatedGradeTypeRow {
	sectionCode: string;
	gradeTypeCode: string;
}

// The two parallel arrays the merge binds, aggregated by the database — ENROLLED_SECTION_STUDENTS_SQL's
// own shape.
export interface EnrolledSectionStudentRow {
	sectionCodes: string[];
	studentCodes: string[];
}

// A reader over the materialized export: one unfiltered pass, tagging each row with whether it
// carries an observation. Collected in full by ScrapingExportsService.fetchGradesRcRows; the
// two-sheet split happens in memory on that array, not here (see ADR-004).
export interface GradesRcExportHandle {
	rows: () => AsyncGenerator<GradeRcExportRow & { hasObservations: boolean }>;
	close: () => Promise<void>;
}

/**
 * Builds the RC bulk-upload-ready data out of both scrapings — Banner and Planner, which share the
 * raw DB, so the whole cross runs in one SQL pass. Reads only.
 */
@Injectable()
export class GradesRcExportRepository {
	private readonly logger = new Logger(GradesRcExportRepository.name);

	constructor(
		@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly rawDataSource: DataSource,
		@InjectDataSource() private readonly mainDataSource: DataSource,
	) {}

	/**
	 * Runs the merge into a per-session scratch table and hands back a paging reader over it.
	 *
	 * The handle OWNS a pooled connection until `close()`. Callers must call it in a `finally`;
	 * leaking one leaks a connection for the life of the process.
	 */
	async openGradesRcExport(academicPeriodId: number): Promise<GradesRcExportHandle> {
		const params = await this.buildGradesRcParams(academicPeriodId);

		// A TEMP table lives in the session that created it, and dataSource.query() takes an arbitrary
		// pooled connection each call, so create and reads are pinned to one runner.
		const runner = this.rawDataSource.createQueryRunner();
		await runner.connect();

		try {
			// The pooled connection may still carry the table from an export that died before its
			// close(); TEMP tables outlive the request, not the session.
			await runner.query(`DROP TABLE IF EXISTS ${GRADES_RC_TEMP_TABLE}`);
			// Plain SET, not SET LOCAL: this runner is never in an explicit transaction, and SET LOCAL
			// outside one has no effect. Reset before release in closeGradesRcExport instead, since a
			// pooled connection is reused by unrelated queries once returned.
			await runner.query(`SET work_mem = '128MB'`);
			await runner.query(`SET jit = off`);
			// Pairs with section_designated's MATERIALIZED hint (grades-rc-export.sql.ts): forces a
			// hash join over it instead of a per-row scan. Scoped to this connection, same as above.
			await runner.query(`SET enable_nestloop = off`);
			await runner.query(MATERIALIZE_GRADES_RC_SQL, params);
			await this.resolveInStudyPlanRescues(runner, academicPeriodId);
			await runner.query(INDEX_GRADES_RC_TEMP_SQL);
			// CREATE TABLE AS writes no statistics and autovacuum never analyzes a TEMP table, so
			// without this the planner guesses at the "hasObservations" selectivity of every page.
			await runner.query(`ANALYZE ${GRADES_RC_TEMP_TABLE}`);
		} catch (error) {
			await this.closeGradesRcExport(runner);
			throw error;
		}

		return {
			rows: () => this.readGradesRcPages(runner),
			close: () => this.closeGradesRcExport(runner),
		};
	}

	private async *readGradesRcPages(
		runner: QueryRunner,
	): AsyncGenerator<GradeRcExportRow & { hasObservations: boolean }> {
		let lastSeq = '0';

		for (;;) {
			const page: Array<GradeRcExportRow & { exportSeq: string; hasObservations: boolean }> =
				await runner.query(READ_GRADES_RC_ALL_PAGE_SQL, [lastSeq, GRADES_RC_PAGE_SIZE]);
			if (page.length === 0) return;

			for (const row of page) yield row;
			lastSeq = page[page.length - 1].exportSeq;
		}
	}

	// A failed DROP or RESET must not keep the connection out of the pool, hence the nested finally.
	private async closeGradesRcExport(runner: QueryRunner): Promise<void> {
		try {
			await runner.query(`DROP TABLE IF EXISTS ${GRADES_RC_TEMP_TABLE}`);
		} finally {
			try {
				// Independent, not sequential-and-hope: a failed RESET must not skip the ones after
				// it. Left unreset, enable_nestloop=off in particular is a planner-wide override that
				// would silently degrade unrelated queries on the next reuse of this pooled connection.
				const settings = ['work_mem', 'jit', 'enable_nestloop'];
				const results = await Promise.allSettled(
					settings.map((setting) => runner.query(`RESET ${setting}`)),
				);
				// A rejection here means this pooled connection returns to the pool with that setting
				// still active -- worth a log, since it is otherwise silent until it degrades an
				// unrelated query's plan later.
				results.forEach((result, index) => {
					if (result.status === 'rejected') {
						this.logger.warn(
							`Failed to RESET ${settings[index]} on the gradesRc export connection before ` +
								`release: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
						);
					}
				});
			} finally {
				await runner.release();
			}
		}
	}

	// Gathered before the scratch table exists, so a failure here costs no connection. No study-plan
	// pairs here -- see resolveInStudyPlanRescues, which runs that lookup after the merge instead.
	private async buildGradesRcParams(academicPeriodId: number): Promise<unknown[]> {
		const [
			period,
			gradeTypes,
			qualificationStatuses,
			designated,
			uploadedSections,
			controlSections,
			periodEnrolledStudentCodes,
		] = await Promise.all([
			resolveAcademicPeriodCode(this.mainDataSource, academicPeriodId),
			this.getTypeCodesByName(TYPE_GROUP_CODES.GRADE_TYPE),
			this.getTypeCodesByName(TYPE_GROUP_CODES.QUALIFICATION_STATUS),
			this.getDesignatedGradeTypesBySection(academicPeriodId),
			this.getUploadedSectionCodes(academicPeriodId),
			this.getControlOutcomeSectionCodes(academicPeriodId),
			this.getPeriodEnrolledStudentCodes(academicPeriodId),
		]);

		// Intersected here, not as a second array the SQL ANDs together: two scope arrays on
		// section_code read as independent to the planner, which multiplies their selectivities and
		// underestimates the scope by orders of magnitude. That flipped the merge's joins and the
		// export stopped finishing at all.
		const controlScope = new Set(controlSections);
		const scopedSections = uploadedSections.filter((section) => controlScope.has(section));

		const enrollments = await this.getEnrolledSectionStudents(academicPeriodId, scopedSections);

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
			scopedSections,
			TYPE_CODES.QUALIFICATION_STATUS.RET,
			enrollments.sectionCodes,
			enrollments.studentCodes,
			Object.keys(PROGRAM_CAREER_MAP),
			Object.values(PROGRAM_CAREER_MAP),
			TYPE_CODES.QUALIFICATION_STATUS.NR,
			periodEnrolledStudentCodes,
		];
	}

	// Second pass of the study-plan rescue (see `period_enrolled` in GRADES_RC_SQL for why this is a
	// second pass at all). Scoped to the merge's own notInSection candidates, not the whole cohort.
	private async resolveInStudyPlanRescues(
		runner: QueryRunner,
		academicPeriodId: number,
	): Promise<void> {
		const candidates: Array<{ sectionCode: string; studentCode: string }> = await runner.query(
			NOT_IN_SECTION_CANDIDATES_SQL,
		);

		const matched = candidates.length
			? ((await this.mainDataSource.query(STUDY_PLAN_MEMBERSHIP_FOR_PAIRS_SQL, [
					academicPeriodId,
					candidates.map((pair) => pair.sectionCode),
					candidates.map((pair) => pair.studentCode),
				])) as Array<{ sectionCode: string; studentCode: string }>)
			: [];

		// An empty `matched` still runs: NOT EXISTS over an empty unnest is true for every remaining
		// notInSection row, which correctly prunes all of them when nothing was rescued.
		await runner.query(PRUNE_GRADES_RC_UNRESOLVED_SQL, [
			matched.map((pair) => pair.sectionCode),
			matched.map((pair) => pair.studentCode),
		]);
		await runner.query(DROP_NOT_IN_SECTION_COLUMN_SQL);
	}

	// The second hard scope: a course with no CONTROL outcome mapped in the period's study plan is
	// invisible to the RC semaphore, so exporting its grades only loads data nothing reads.
	async getControlOutcomeSectionCodes(academicPeriodId: number): Promise<string[]> {
		const rows: Array<{ sectionCode: string }> = await this.mainDataSource.query(
			CONTROL_OUTCOME_SECTIONS_SQL,
			[academicPeriodId, TYPE_CODES.OUTCOME_TYPE.CONTROL],
		);
		return rows.map((row) => row.sectionCode);
	}

	// Not a hard filter alone: a row missing this pair still ships if resolveInStudyPlanRescues
	// rescues it afterwards. sectionScope narrows which sections are worth fetching at all.
	async getEnrolledSectionStudents(
		academicPeriodId: number,
		sectionScope: string[],
	): Promise<EnrolledSectionStudentRow> {
		const [row]: EnrolledSectionStudentRow[] = await this.mainDataSource.query(
			ENROLLED_SECTION_STUDENTS_SQL,
			[academicPeriodId, sectionScope],
		);
		return row ?? { sectionCodes: [], studentCodes: [] };
	}

	// Not a filter either: a section missing here behaves as "designated type absent", arming the
	// fallback.
	async getDesignatedGradeTypesBySection(
		academicPeriodId: number,
	): Promise<DesignatedGradeTypeRow[]> {
		return await this.mainDataSource.query(DESIGNATED_GRADE_TYPES_SQL, [academicPeriodId]);
	}

	// This one IS a hard scope: a grade whose section is not here appears in neither sheet. Dropped
	// rather than reported, since it can only be fixed by loading the section, not from this file.
	async getUploadedSectionCodes(academicPeriodId: number): Promise<string[]> {
		const rows: Array<{ sectionCode: string }> = await this.mainDataSource.query(
			UPLOADED_SECTIONS_SQL,
			[academicPeriodId],
		);
		return rows.map((row) => row.sectionCode);
	}

	// Hard scope, broader than getEnrolledSectionStudents: a student not matriculated for the period
	// at all has nowhere to land, so their grade is dropped rather than reported.
	async getPeriodEnrolledStudentCodes(academicPeriodId: number): Promise<string[]> {
		const rows: Array<{ studentCode: string }> = await this.mainDataSource.query(
			PERIOD_ENROLLED_STUDENTS_SQL,
			[academicPeriodId],
		);
		return rows.map((row) => row.studentCode);
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
