import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
	AlumnoMatriculadoExportRow,
	AlumnoSeccionExportRow,
	DocenteExportRow,
	SeccionExportRow,
} from '../model/scraping-exports.types';

export const EXPORTS_RAW_CONNECTION = 'exports-raw';

// Planner stores teacherName as "Apellidos, Nombres". Split on the first comma; if there is no
// comma, treat the whole string as the last name.
function splitTeacherName(name: string | null): { lastName: string; firstName: string } {
	const value = (name ?? '').trim();
	const comma = value.indexOf(',');
	if (comma === -1) return { lastName: value, firstName: '' };
	return { lastName: value.slice(0, comma).trim(), firstName: value.slice(comma + 1).trim() };
}

/**
 * Read side of the scraping-export feature. All raw tables (Banner + Planner) live in the same
 * scraping DB, so the cross-source enrichment is a plain SQL join. Reads only — never writes.
 */
@Injectable()
export class ScrapingExportsRepository {
	constructor(@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly dataSource: DataSource) {}

	// Distinct teachers from the latest Planner run. The professor code is the scraped teacherCode.
	// The email is the real institutional one pulled from Banner's raw_horario: Banner has no short
	// teacher code and Planner has no email, so the two are matched by name ("Apellidos, Nombres",
	// case/space-insensitive). Blank when there is no Banner match (Banner only scraped some depts).
	async getDocentes(): Promise<DocenteExportRow[]> {
		const rows: Array<{
			professorCode: string;
			teacherName: string | null;
			email: string | null;
		}> = await this.dataSource.query(`
			WITH banner_email AS (
				SELECT
					lower(btrim(d->>'apellidos') || ', ' || btrim(d->>'nombres')) AS name_key,
					max(d->>'correo')                                             AS correo
				FROM raw_horario h
				CROSS JOIN LATERAL jsonb_array_elements(COALESCE(h.payload->'horarios', '[]'::jsonb)) hr
				CROSS JOIN LATERAL jsonb_array_elements(COALESCE(hr->'docentes', '[]'::jsonb)) d
				WHERE NULLIF(d->>'correo', '') IS NOT NULL
				GROUP BY 1
			)
			SELECT DISTINCT ON (t->>'teacherCode')
				t->>'teacherCode' AS "professorCode",
				t->>'teacherName' AS "teacherName",
				be.correo         AS "email"
			FROM raw_planner_seccion s
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'teachers', '[]'::jsonb)) t
			LEFT JOIN banner_email be ON be.name_key = lower(btrim(t->>'teacherName'))
			WHERE s.run_id = (SELECT id FROM planner_scrape_run ORDER BY started_at DESC LIMIT 1)
			  AND NULLIF(trim(t->>'teacherCode'), '') IS NOT NULL
			ORDER BY t->>'teacherCode'
		`);

		return rows.map((row) => {
			const { lastName, firstName } = splitTeacherName(row.teacherName);
			return {
				professorCode: row.professorCode,
				lastName,
				firstName,
				email: row.email ?? '',
			};
		});
	}

	// One row per Planner section (latest run). professorCode = the principal teacher's code.
	// campus + modality are enriched from any Banner horario whose NRC equals the Planner
	// sectionName (most recent first); left blank when there is no Banner match.
	async getSecciones(): Promise<SeccionExportRow[]> {
		const rows: Array<{
			courseCode: string | null;
			sectionCode: string | null;
			professorCode: string | null;
			campusCode: string | null;
			modalityCode: string | null;
		}> = await this.dataSource.query(`
			SELECT DISTINCT ON (s.payload->>'sectionName')
				s.payload->'courses'->0->>'courseCode' AS "courseCode",
				s.payload->>'sectionName'              AS "sectionCode",
				prof.teacher_code                      AS "professorCode",
				h.campus_code                          AS "campusCode",
				h.modality_code                        AS "modalityCode"
			FROM raw_planner_seccion s
			LEFT JOIN LATERAL (
				SELECT t->>'teacherCode' AS teacher_code
				FROM jsonb_array_elements(COALESCE(s.payload->'teachers', '[]'::jsonb)) t
				WHERE NULLIF(trim(t->>'teacherCode'), '') IS NOT NULL
				ORDER BY (t->>'isPrincipal')::int DESC NULLS LAST
				LIMIT 1
			) prof ON true
			LEFT JOIN LATERAL (
				SELECT
					h2.payload->'horarios'->0->'campus'->>'codigo'          AS campus_code,
					h2.payload->'horarios'->0->'metodoEducativo'->>'codigo' AS modality_code
				FROM raw_horario h2
				WHERE h2.nrc = s.payload->>'sectionName'
				ORDER BY h2.scraped_at DESC
				LIMIT 1
			) h ON true
			WHERE s.run_id = (SELECT id FROM planner_scrape_run ORDER BY started_at DESC LIMIT 1)
			  AND NULLIF(trim(s.payload->>'sectionName'), '') IS NOT NULL
			ORDER BY s.payload->>'sectionName'
		`);

		return rows.map((row) => ({
			courseCode: row.courseCode ?? '',
			sectionCode: row.sectionCode ?? '',
			professorCode: row.professorCode ?? '',
			campusCode: row.campusCode ?? '',
			sectionModalityTypeCode: row.modalityCode ?? '',
		}));
	}

	// Distinct enrolled students from the latest Banner run. Enrollment modality is not carried by
	// the Banner student payload, so it is left blank.
	async getAlumnosMatriculados(): Promise<AlumnoMatriculadoExportRow[]> {
		const rows: Array<{
			studentCode: string;
			lastName: string | null;
			firstName: string | null;
			programCode: string | null;
			campusCode: string | null;
		}> = await this.dataSource.query(`
			SELECT DISTINCT ON (a.codigo_alumno)
				a.codigo_alumno                   AS "studentCode",
				a.payload->>'apellidos'           AS "lastName",
				a.payload->>'nombres'             AS "firstName",
				a.payload->'programa'->>'codigo'  AS "programCode",
				a.payload->'campus'->>'codigo'    AS "campusCode"
			FROM raw_alumno a
			WHERE a.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
			  AND NULLIF(trim(a.codigo_alumno), '') IS NOT NULL
			ORDER BY a.codigo_alumno
		`);

		return rows.map((row) => ({
			studentCode: row.studentCode,
			lastName: row.lastName ?? '',
			firstName: row.firstName ?? '',
			programCode: row.programCode ?? '',
			campusCode: row.campusCode ?? '',
			enrollmentModalityTypeCode: '',
		}));
	}

	// Distinct (section, student) pairs from the latest Banner run. The Banner NRC doubles as the
	// section code (same namespace as the Planner sectionName used by the sections export), and the
	// student code matches the enrolled-students export (both Banner).
	async getAlumnosSecciones(): Promise<AlumnoSeccionExportRow[]> {
		const rows: Array<{ sectionCode: string; studentCode: string }> = await this.dataSource.query(`
				SELECT DISTINCT m.nrc AS "sectionCode", m.codigo_alumno AS "studentCode"
				FROM raw_matricula m
				WHERE m.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
				  AND NULLIF(trim(m.nrc), '') IS NOT NULL
				  AND NULLIF(trim(m.codigo_alumno), '') IS NOT NULL
				ORDER BY m.nrc, m.codigo_alumno
			`);

		return rows.map((row) => ({ sectionCode: row.sectionCode, studentCode: row.studentCode }));
	}
}
