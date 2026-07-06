import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
	AlumnoMatriculadoExportRow,
	AlumnoSeccionExportRow,
	DocenteExportRow,
	SeccionExportRow,
} from '../model/scraping-exports.types';
import {
	DEFAULT_ENROLLMENT_STATUS,
	DEFAULT_SECTION_MODALITY,
	mapCampus,
	mapProgramToCareer,
} from '../model/scraping-exports.transforms';

export const EXPORTS_RAW_CONNECTION = 'exports-raw';

/**
 * Read side of the scraping-export feature. The raw tables live in the scraping DB ("exports-raw").
 * The exports always return the full latest scrape (every career); they are NOT scoped per school —
 * the per-career/program filtering happens on the upload side (audit.fn_validate_program_modality /
 * audit.fn_upload_enrolled_students validate each row's programCode against academic.programs). The
 * only narrowing kept here is dropping non-engineering programs from matriculados (mapProgramToCareer
 * returns null for them). Reads only — never writes.
 */
@Injectable()
export class ScrapingExportsRepository {
	constructor(@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly dataSource: DataSource) {}

	// Distinct teachers from the latest Banner run, taken straight from raw_horario's docentes.
	// professorCode = idBanner (the "N0…" user code the original system uses), and last name /
	// first name / email come from the same record, so the email is always present and the code is in
	// the expected format.
	async getDocentes(): Promise<DocenteExportRow[]> {
		const rows: Array<{
			professorCode: string;
			lastName: string | null;
			firstName: string | null;
			email: string | null;
		}> = await this.dataSource.query(`
			SELECT DISTINCT ON (d->>'idBanner')
				d->>'idBanner'  AS "professorCode",
				d->>'apellidos' AS "lastName",
				d->>'nombres'   AS "firstName",
				d->>'correo'    AS "email"
			FROM raw_horario h
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(h.payload->'horarios', '[]'::jsonb)) hr
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(hr->'docentes', '[]'::jsonb)) d
			WHERE h.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
			  AND NULLIF(trim(d->>'idBanner'), '') IS NOT NULL
			ORDER BY d->>'idBanner'
		`);

		return rows.map((row) => ({
			professorCode: row.professorCode,
			lastName: row.lastName ?? '',
			firstName: row.firstName ?? '',
			email: row.email ?? '',
		}));
	}

	// One row per Banner section (latest run), straight from raw_horario — same source the original
	// system uses. courseCode = materia.codigo + numeroCurso, sectionCode = nrc, professorCode = the
	// principal teacher's idBanner (so it lines up with the docentes export), campus = mapped Banner
	// campus, modality = Banner metodoEducativo (defaulting to "P" when missing).
	async getSecciones(): Promise<SeccionExportRow[]> {
		const rows: Array<{
			courseCode: string | null;
			sectionCode: string;
			professorCode: string | null;
			campusCode: string | null;
			modalityCode: string | null;
		}> = await this.dataSource.query(`
			SELECT DISTINCT ON (h.nrc)
				(h.payload->'materia'->>'codigo') || (h.payload->>'numeroCurso') AS "courseCode",
				h.nrc                                                            AS "sectionCode",
				prof.idb                                                         AS "professorCode",
				h.payload->'horarios'->0->'campus'->>'codigo'                    AS "campusCode",
				h.payload->'horarios'->0->'metodoEducativo'->>'codigo'           AS "modalityCode"
			FROM raw_horario h
			LEFT JOIN LATERAL (
				SELECT d->>'idBanner' AS idb
				FROM jsonb_array_elements(COALESCE(h.payload->'horarios', '[]'::jsonb)) hr
				CROSS JOIN jsonb_array_elements(COALESCE(hr->'docentes', '[]'::jsonb)) d
				WHERE NULLIF(trim(d->>'idBanner'), '') IS NOT NULL
				ORDER BY (d->>'esPrincipal')::boolean DESC NULLS LAST
				LIMIT 1
			) prof ON true
			WHERE h.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
			  AND NULLIF(trim(h.nrc), '') IS NOT NULL
			ORDER BY h.nrc
		`);

		return rows.map((row) => ({
			courseCode: row.courseCode ?? '',
			sectionCode: row.sectionCode,
			professorCode: row.professorCode ?? '',
			campusCode: mapCampus(row.campusCode),
			sectionModalityTypeCode: row.modalityCode ?? DEFAULT_SECTION_MODALITY,
		}));
	}

	// Distinct enrolled students from the latest Banner run. The program is mapped to its academic
	// career code (SW/CC/…), the campus to the short code (CS/MO/SI/VL), and the enrollment column is
	// hardcoded to "P" for now. Every engineering student is kept; non-engineering programs are
	// dropped by mapProgramToCareer (the only filtering left — the rest happens on upload).
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

		return rows.flatMap((row) => {
			const career = mapProgramToCareer(row.programCode);
			if (career === null) return [];
			return [
				{
					studentCode: row.studentCode,
					lastName: row.lastName ?? '',
					firstName: row.firstName ?? '',
					programCode: career,
					campusCode: mapCampus(row.campusCode),
					enrollmentModalityTypeCode: DEFAULT_ENROLLMENT_STATUS,
				},
			];
		});
	}

	// Distinct (section, student) pairs from the latest Banner run. The Banner NRC doubles as the
	// section code (same namespace as the sections export), and the student code matches the
	// enrolled-students export (both Banner).
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
