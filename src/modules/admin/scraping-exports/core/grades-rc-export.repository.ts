import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

import { GradeRcExportRow } from '../model/scraping-exports.types';
import { DESIGNATED_GRADE_TYPES_SQL, GRADES_RC_SQL } from './grades-rc-export.sql';
import { EXPORTS_RAW_CONNECTION, resolveAcademicPeriodCode } from './scraping-exports.repository';

export interface DesignatedGradeTypeRow {
	sectionCode: string;
	gradeTypeCode: string;
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
 *    upload rejects until someone registers it in TG205 — see the change runbook.
 */
@Injectable()
export class GradesRcExportRepository {
	constructor(
		@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly rawDataSource: DataSource,
		@InjectDataSource() private readonly mainDataSource: DataSource,
	) {}

	async getGradesRcRows(academicPeriodId: number | null): Promise<GradeRcExportRow[]> {
		const [period, gradeTypes, qualificationStatuses, designated] = await Promise.all([
			resolveAcademicPeriodCode(this.mainDataSource, academicPeriodId),
			this.getTypeCodesByName(TYPE_GROUP_CODES.GRADE_TYPE),
			this.getTypeCodesByName(TYPE_GROUP_CODES.QUALIFICATION_STATUS),
			this.getDesignatedGradeTypesBySection(academicPeriodId),
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
		]);
	}

	// Not a filter on the export: sections missing here (not uploaded yet, or with no designated
	// type configured) simply behave as "designated type absent", which arms the fallback.
	async getDesignatedGradeTypesBySection(
		academicPeriodId: number | null,
	): Promise<DesignatedGradeTypeRow[]> {
		if (academicPeriodId == null) return [];
		return await this.mainDataSource.query(DESIGNATED_GRADE_TYPES_SQL, [academicPeriodId]);
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
