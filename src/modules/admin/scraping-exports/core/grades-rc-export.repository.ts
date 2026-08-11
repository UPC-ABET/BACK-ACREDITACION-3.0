import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

import { GradeRcExportRow } from '../model/scraping-exports.types';
import { PROGRAM_CAREER_MAP } from '../model/scraping-exports.transforms';
import {
	DESIGNATED_GRADE_TYPES_SQL,
	ENROLLED_SECTION_STUDENTS_SQL,
	GRADES_RC_SQL,
	UPLOADED_SECTIONS_SQL,
} from './grades-rc-export.sql';
import { EXPORTS_RAW_CONNECTION, resolveAcademicPeriodCode } from './scraping-exports.repository';

export interface DesignatedGradeTypeRow {
	sectionCode: string;
	gradeTypeCode: string;
}

export interface EnrolledSectionStudentRow {
	sectionCode: string;
	studentCode: string;
}

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

	async getGradesRcRows(academicPeriodId: number): Promise<GradeRcExportRow[]> {
		const [period, gradeTypes, qualificationStatuses, designated, uploadedSections, enrollments] =
			await Promise.all([
				resolveAcademicPeriodCode(this.mainDataSource, academicPeriodId),
				this.getTypeCodesByName(TYPE_GROUP_CODES.GRADE_TYPE),
				this.getTypeCodesByName(TYPE_GROUP_CODES.QUALIFICATION_STATUS),
				this.getDesignatedGradeTypesBySection(academicPeriodId),
				this.getUploadedSectionCodes(academicPeriodId),
				this.getEnrolledSectionStudents(academicPeriodId),
			]);

		return await this.rawDataSource.query(GRADES_RC_SQL, [
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
			enrollments.map((row) => row.sectionCode),
			enrollments.map((row) => row.studentCode),
			Object.keys(PROGRAM_CAREER_MAP),
			Object.values(PROGRAM_CAREER_MAP),
		]);
	}

	// Not a filter either: a row whose (section, student) pair is missing is still exported, and
	// carries an observation saying the upload will reject the file over it. See
	// ENROLLED_SECTION_STUDENTS_SQL.
	async getEnrolledSectionStudents(academicPeriodId: number): Promise<EnrolledSectionStudentRow[]> {
		return await this.mainDataSource.query(ENROLLED_SECTION_STUDENTS_SQL, [academicPeriodId]);
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
