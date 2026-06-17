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

const UPC_EMAIL_DOMAIN = '@upc.edu.pe';

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
	constructor(
		@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly dataSource: DataSource,
	) {}

	// Distinct teachers from the latest Planner run. The professor code is the scraped teacherCode;
	// the email is derived as `${teacherCode}@upc.edu.pe`.
	async getDocentes(): Promise<DocenteExportRow[]> {
		const rows: Array<{ professor_code: string; teacher_name: string | null }> =
			await this.dataSource.query(`
				SELECT DISTINCT ON (t->>'teacherCode')
					t->>'teacherCode' AS professor_code,
					t->>'teacherName' AS teacher_name
				FROM raw_planner_seccion s
				CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'teachers', '[]'::jsonb)) t
				WHERE s.run_id = (SELECT id FROM planner_scrape_run ORDER BY started_at DESC LIMIT 1)
				  AND NULLIF(trim(t->>'teacherCode'), '') IS NOT NULL
				ORDER BY t->>'teacherCode'
			`);

		return rows.map((row) => {
			const { lastName, firstName } = splitTeacherName(row.teacher_name);
			return {
				professorCode: row.professor_code,
				lastName,
				firstName,
				email: `${row.professor_code}${UPC_EMAIL_DOMAIN}`,
			};
		});
	}

	// One row per Planner section (latest run). professorCode = the principal teacher's code.
	// campus + modality are enriched from any Banner horario whose NRC equals the Planner
	// sectionName (most recent first); left blank when there is no Banner match.
	async getSecciones(): Promise<SeccionExportRow[]> {
		const rows: Array<{
			course_code: string | null;
			section_code: string | null;
			professor_code: string | null;
			campus_code: string | null;
			modality_code: string | null;
		}> = await this.dataSource.query(`
			SELECT DISTINCT ON (s.payload->>'sectionName')
				s.payload->'courses'->0->>'courseCode' AS course_code,
				s.payload->>'sectionName'              AS section_code,
				prof.teacher_code                      AS professor_code,
				h.campus_code,
				h.modality_code
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
			courseCode: row.course_code ?? '',
			sectionCode: row.section_code ?? '',
			professorCode: row.professor_code ?? '',
			campusCode: row.campus_code ?? '',
			sectionModalityTypeCode: row.modality_code ?? '',
		}));
	}

	// Distinct enrolled students from the latest Banner run. Enrollment modality is not carried by
	// the Banner student payload, so it is left blank.
	async getAlumnosMatriculados(): Promise<AlumnoMatriculadoExportRow[]> {
		const rows: Array<{
			student_code: string;
			last_name: string | null;
			first_name: string | null;
			program_code: string | null;
			campus_code: string | null;
		}> = await this.dataSource.query(`
			SELECT DISTINCT ON (a.codigo_alumno)
				a.codigo_alumno                   AS student_code,
				a.payload->>'apellidos'           AS last_name,
				a.payload->>'nombres'             AS first_name,
				a.payload->'programa'->>'codigo'  AS program_code,
				a.payload->'campus'->>'codigo'    AS campus_code
			FROM raw_alumno a
			WHERE a.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
			  AND NULLIF(trim(a.codigo_alumno), '') IS NOT NULL
			ORDER BY a.codigo_alumno
		`);

		return rows.map((row) => ({
			studentCode: row.student_code,
			lastName: row.last_name ?? '',
			firstName: row.first_name ?? '',
			programCode: row.program_code ?? '',
			campusCode: row.campus_code ?? '',
			enrollmentModalityTypeCode: '',
		}));
	}

	// Distinct (section, student) pairs from the latest Banner run. The Banner NRC doubles as the
	// section code (same namespace as the Planner sectionName used by the sections export), and the
	// student code matches the enrolled-students export (both Banner).
	async getAlumnosSecciones(): Promise<AlumnoSeccionExportRow[]> {
		const rows: Array<{ section_code: string; student_code: string }> =
			await this.dataSource.query(`
				SELECT DISTINCT m.nrc AS section_code, m.codigo_alumno AS student_code
				FROM raw_matricula m
				WHERE m.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
				  AND NULLIF(trim(m.nrc), '') IS NOT NULL
				  AND NULLIF(trim(m.codigo_alumno), '') IS NOT NULL
				ORDER BY m.nrc, m.codigo_alumno
			`);

		return rows.map((row) => ({ sectionCode: row.section_code, studentCode: row.student_code }));
	}
}
