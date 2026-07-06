import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { EXPORTS_RAW_CONNECTION } from './scraping-exports.repository';

export interface RawGradeRcRow {
	sectionCode: string;
	studentCode: string;
	type: string;
	weight: string;
	gradeRaw: string;
}

/**
 * Builds the RC bulk-upload-ready data out of the Banner raw scraping tables (raw_notas +
 * raw_horario + raw_matricula, same run). Reads only: when Banner reports a non-numeric grade
 * value this catalog doesn't recognize yet (e.g. a new qualification-status code), the raw text
 * is passed through as-is in the exported Excel -- resolving or auto-provisioning it into
 * core.types (TG404) is the RC bulk upload's job (fn_upload_grades_rc), not this export's.
 */
@Injectable()
export class GradesRcExportRepository {
	constructor(
		@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly rawDataSource: DataSource,
		@InjectDataSource() private readonly mainDataSource: DataSource,
	) {}

	// One row per (student, course, grade type) from the latest Banner run, with the section (NRC)
	// resolved via raw_horario + raw_matricula of that same run. A student can only be enrolled in
	// one section of a given course per academic period, so the join is unambiguous.
	async getRawGradesRc(): Promise<RawGradeRcRow[]> {
		return await this.rawDataSource.query(`
			WITH latest_run AS (
				SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1
			),
			grades_exploded AS (
				SELECT
					rn.codigo_alumno,
					rn.curso_codigo,
					n->>'tipo' AS type,
					n->>'peso' AS weight,
					n->>'nota' AS grade_raw
				FROM raw_notas rn
				CROSS JOIN LATERAL jsonb_array_elements(rn.payload->'detalle'->'notas') AS n
				WHERE rn.run_id = (SELECT id FROM latest_run)
			),
			section_lookup AS (
				SELECT DISTINCT
					m.codigo_alumno,
					h.nrc,
					(h.payload->'materia'->>'codigo') || (h.payload->>'numeroCurso') AS curso_codigo
				FROM raw_matricula m
				JOIN raw_horario h ON h.run_id = m.run_id AND h.nrc = m.nrc
				WHERE m.run_id = (SELECT id FROM latest_run)
				  AND NULLIF(trim(m.codigo_alumno), '') IS NOT NULL
			)
			SELECT
				sl.nrc           AS "sectionCode",
				ge.codigo_alumno AS "studentCode",
				ge.type          AS "type",
				ge.weight        AS "weight",
				ge.grade_raw     AS "gradeRaw"
			FROM grades_exploded ge
			JOIN section_lookup sl
			  ON sl.codigo_alumno = ge.codigo_alumno AND sl.curso_codigo = ge.curso_codigo
			ORDER BY sl.nrc, ge.codigo_alumno, ge.type
		`);
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
