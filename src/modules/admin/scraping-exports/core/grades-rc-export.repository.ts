import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

import { GradeRcExportRow } from '../model/scraping-exports.types';
import { PROGRAM_CAREER_MAP } from '../model/scraping-exports.transforms';
import {
	CONTROL_OUTCOME_SECTIONS_SQL,
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

// A reader over the materialized export. Each worksheet asks for its own half: `withObservations`
// false yields the clean rows, true the ones carrying an observation.
export interface GradesRcExportHandle {
	rows: (withObservations: boolean) => AsyncGenerator<GradeRcExportRow>;
	close: () => Promise<void>;
}

// Rows held in memory at a time. Small enough that the peak no longer scales with the period, large
// enough that a full period is tens of round trips rather than thousands.
const GRADES_RC_PAGE_SIZE = 5000;

/**
 * Builds the RC bulk-upload-ready data out of both scrapings — Banner and Planner, which share the
 * raw DB, so the whole cross runs in one SQL pass. Reads only.
 */
@Injectable()
export class GradesRcExportRepository {
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
			await runner.query(MATERIALIZE_GRADES_RC_SQL, params);
			await runner.query(INDEX_GRADES_RC_TEMP_SQL);
			// CREATE TABLE AS writes no statistics and autovacuum never analyzes a TEMP table, so
			// without this the planner guesses at the "hasObservations" selectivity of every page.
			await runner.query(`ANALYZE ${GRADES_RC_TEMP_TABLE}`);
		} catch (error) {
			await this.closeGradesRcExport(runner);
			throw error;
		}

		return {
			rows: (withObservations: boolean) => this.readGradesRcPages(runner, withObservations),
			close: () => this.closeGradesRcExport(runner),
		};
	}

	private async *readGradesRcPages(
		runner: QueryRunner,
		withObservations: boolean,
	): AsyncGenerator<GradeRcExportRow> {
		let lastSeq = '0';

		for (;;) {
			const page: Array<GradeRcExportRow & { exportSeq: string; hasObservations: boolean }> =
				await runner.query(READ_GRADES_RC_PAGE_SQL, [
					lastSeq,
					GRADES_RC_PAGE_SIZE,
					withObservations,
				]);
			if (page.length === 0) return;

			for (const row of page) yield row;
			lastSeq = page[page.length - 1].exportSeq;
		}
	}

	// A failed DROP must not keep the connection out of the pool, hence the finally.
	private async closeGradesRcExport(runner: QueryRunner): Promise<void> {
		try {
			await runner.query(`DROP TABLE IF EXISTS ${GRADES_RC_TEMP_TABLE}`);
		} finally {
			await runner.release();
		}
	}

	// Gathered before the scratch table exists, so a failure here costs no connection.
	private async buildGradesRcParams(academicPeriodId: number): Promise<unknown[]> {
		const [
			period,
			gradeTypes,
			qualificationStatuses,
			designated,
			uploadedSections,
			enrollments,
			controlSections,
		] = await Promise.all([
			resolveAcademicPeriodCode(this.mainDataSource, academicPeriodId),
			this.getTypeCodesByName(TYPE_GROUP_CODES.GRADE_TYPE),
			this.getTypeCodesByName(TYPE_GROUP_CODES.QUALIFICATION_STATUS),
			this.getDesignatedGradeTypesBySection(academicPeriodId),
			this.getUploadedSectionCodes(academicPeriodId),
			this.getEnrolledSectionStudents(academicPeriodId),
			this.getControlOutcomeSectionCodes(academicPeriodId),
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
			TYPE_CODES.QUALIFICATION_STATUS.NR,
			controlSections,
		];
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

	// Not a filter: a row whose pair is missing still ships, carrying the observation that says so.
	async getEnrolledSectionStudents(academicPeriodId: number): Promise<EnrolledSectionStudentRow> {
		const [row]: EnrolledSectionStudentRow[] = await this.mainDataSource.query(
			ENROLLED_SECTION_STUDENTS_SQL,
			[academicPeriodId],
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
