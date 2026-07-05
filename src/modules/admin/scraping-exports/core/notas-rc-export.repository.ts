import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { EXPORTS_RAW_CONNECTION } from './scraping-exports.repository';

export interface RawNotaRcRow {
	sectionCode: string;
	studentCode: string;
	tipo: string;
	peso: string;
	notaRaw: string;
}

/**
 * Builds the RC bulk-upload-ready data out of the Banner raw scraping tables (raw_notas +
 * raw_horario + raw_matricula, same run). Reads only: when Banner reports a non-numeric grade
 * value this catalog doesn't recognize yet (e.g. a new qualification-status code), the raw text
 * is passed through as-is in the exported Excel -- resolving or auto-provisioning it into
 * core.types (TG404) is the RC bulk upload's job (fn_upload_grades_rc), not this export's.
 */
@Injectable()
export class NotasRcExportRepository {
	constructor(
		@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly rawDataSource: DataSource,
		@InjectDataSource() private readonly mainDataSource: DataSource,
	) {}

	// One row per (alumno, curso, tipo de nota) from the latest Banner run, with the section (NRC)
	// resolved via raw_horario + raw_matricula of that same run. A student can only be enrolled in
	// one section of a given course per academic period, so the join is unambiguous.
	async getRawNotasRc(): Promise<RawNotaRcRow[]> {
		return await this.rawDataSource.query(`
			WITH latest_run AS (
				SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1
			),
			notas_exploded AS (
				SELECT
					rn.codigo_alumno,
					rn.curso_codigo,
					n->>'tipo' AS tipo,
					n->>'peso' AS peso,
					n->>'nota' AS nota_raw
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
				ne.codigo_alumno AS "studentCode",
				ne.tipo          AS "tipo",
				ne.peso          AS "peso",
				ne.nota_raw      AS "notaRaw"
			FROM notas_exploded ne
			JOIN section_lookup sl
			  ON sl.codigo_alumno = ne.codigo_alumno AND sl.curso_codigo = ne.curso_codigo
			ORDER BY sl.nrc, ne.codigo_alumno, ne.tipo
		`);
	}

	// name (es, uppercased) -> code, for every active type in the given group (main DB).
	async getTypeCodesByName(groupCode: string): Promise<Map<string, string>> {
		const rows: Array<{ code: string; name: string }> = await this.mainDataSource.query(
			`SELECT t.code, UPPER(t.name->>'es') AS name
			 FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1 AND t.is_active = true`,
			[groupCode],
		);
		return new Map(rows.map((r) => [r.name, r.code]));
	}
}
