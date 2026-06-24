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
import { SchoolScope, getSchoolScope } from '../model/scraping-exports.school-scope';

export const EXPORTS_RAW_CONNECTION = 'exports-raw';

/**
 * Read side of the scraping-export feature. The raw tables live in the scraping DB ("exports-raw");
 * the active school is resolved against the main DB. When a school is passed the exports are scoped
 * to it (departments for secciones/docentes, careers for matriculados/alumno-sección); with no
 * school the full scrape is returned. Reads only — never writes.
 */
@Injectable()
export class ScrapingExportsRepository {
	constructor(
		@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly dataSource: DataSource,
		@InjectDataSource() private readonly mainDataSource: DataSource,
	) {}

	// Resolve the active school id (from the X-School-Id header) into its scope. Null when no school
	// is active or the school has no configured scope → exports stay unfiltered.
	private async resolveScope(schoolId: number | null): Promise<SchoolScope | null> {
		if (schoolId == null) return null;
		const rows: Array<{ code: string }> = await this.mainDataSource.query(
			`SELECT code FROM organization.schools WHERE id = $1 LIMIT 1`,
			[schoolId],
		);
		return getSchoolScope(rows[0]?.code);
	}

	// Section-level scope used by secciones/docentes ($1 = departments, $2 = banner programs): a
	// section counts as the school's when it is in one of the school's departments AND at least one
	// of the school's students is enrolled in it. The department alone over-includes (e.g. the SI
	// department is shared with EISCB); the enrollment intersection narrows it to the school's own
	// courses — matching the original system's per-school output.
	private sectionScopeFilter(scope: SchoolScope | null): { clause: string; params: unknown[] } {
		if (!scope) return { clause: '', params: [] };
		return {
			clause: `AND h.departamento = ANY($1)
			  AND h.nrc IN (
				SELECT DISTINCT m.nrc
				FROM raw_matricula m
				WHERE m.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
				  AND m.payload->'programa'->>'codigo' = ANY($2)
				  AND m.nrc IS NOT NULL
			  )`,
			params: [scope.departments, scope.bannerPrograms],
		};
	}

	// Distinct teachers from the latest Banner run, taken straight from raw_horario's docentes.
	// professorCode = idBanner (the "N0…" user code the original system uses), and apellidos /
	// nombres / correo come from the same record, so the email is always present and the code is in
	// the expected format. Scoped by the school's departments when a school is active.
	async getDocentes(schoolId: number | null): Promise<DocenteExportRow[]> {
		const scope = await this.resolveScope(schoolId);
		const { clause, params } = this.sectionScopeFilter(scope);

		const rows: Array<{
			professor_code: string;
			last_name: string | null;
			first_name: string | null;
			email: string | null;
		}> = await this.dataSource.query(
			`
			SELECT DISTINCT ON (d->>'idBanner')
				d->>'idBanner'  AS professor_code,
				d->>'apellidos' AS last_name,
				d->>'nombres'   AS first_name,
				d->>'correo'    AS email
			FROM raw_horario h
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(h.payload->'horarios', '[]'::jsonb)) hr
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(hr->'docentes', '[]'::jsonb)) d
			WHERE h.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
			  AND NULLIF(trim(d->>'idBanner'), '') IS NOT NULL
			  ${clause}
			ORDER BY d->>'idBanner'
		`,
			params,
		);

		return rows.map((row) => ({
			professorCode: row.professor_code,
			lastName: row.last_name ?? '',
			firstName: row.first_name ?? '',
			email: row.email ?? '',
		}));
	}

	// One row per Banner section (latest run), straight from raw_horario — same source the original
	// system uses. courseCode = materia.codigo + numeroCurso, sectionCode = nrc, professorCode = the
	// principal teacher's idBanner (so it lines up with the docentes export), campus = mapped Banner
	// campus, modality = Banner metodoEducativo (defaulting to "P" when missing). Scoped by the
	// school's departments when a school is active.
	async getSecciones(schoolId: number | null): Promise<SeccionExportRow[]> {
		const scope = await this.resolveScope(schoolId);
		const { clause, params } = this.sectionScopeFilter(scope);

		const rows: Array<{
			course_code: string | null;
			section_code: string;
			professor_code: string | null;
			campus_code: string | null;
			modality_code: string | null;
		}> = await this.dataSource.query(
			`
			SELECT DISTINCT ON (h.nrc)
				(h.payload->'materia'->>'codigo') || (h.payload->>'numeroCurso') AS course_code,
				h.nrc                                                            AS section_code,
				prof.idb                                                         AS professor_code,
				h.payload->'horarios'->0->'campus'->>'codigo'                    AS campus_code,
				h.payload->'horarios'->0->'metodoEducativo'->>'codigo'           AS modality_code
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
			  ${clause}
			ORDER BY h.nrc
		`,
			params,
		);

		return rows.map((row) => ({
			courseCode: row.course_code ?? '',
			sectionCode: row.section_code,
			professorCode: row.professor_code ?? '',
			campusCode: mapCampus(row.campus_code),
			sectionModalityTypeCode: row.modality_code ?? DEFAULT_SECTION_MODALITY,
		}));
	}

	// Distinct enrolled students from the latest Banner run. The program is mapped to its academic
	// career code (SW/CC/…), the campus to the short code (CS/MO/SI/VL), and the enrollment column is
	// hardcoded to "P" for now. Scoped by the school's careers when a school is active; otherwise
	// every engineering student is kept (non-engineering programs are always dropped).
	async getAlumnosMatriculados(schoolId: number | null): Promise<AlumnoMatriculadoExportRow[]> {
		const scope = await this.resolveScope(schoolId);
		const progFilter = scope ? `AND a.payload->'programa'->>'codigo' = ANY($1)` : '';
		const params = scope ? [scope.bannerPrograms] : [];

		const rows: Array<{
			student_code: string;
			last_name: string | null;
			first_name: string | null;
			program_code: string | null;
			campus_code: string | null;
		}> = await this.dataSource.query(
			`
			SELECT DISTINCT ON (a.codigo_alumno)
				a.codigo_alumno                   AS student_code,
				a.payload->>'apellidos'           AS last_name,
				a.payload->>'nombres'             AS first_name,
				a.payload->'programa'->>'codigo'  AS program_code,
				a.payload->'campus'->>'codigo'    AS campus_code
			FROM raw_alumno a
			WHERE a.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
			  AND NULLIF(trim(a.codigo_alumno), '') IS NOT NULL
			  ${progFilter}
			ORDER BY a.codigo_alumno
		`,
			params,
		);

		return rows.flatMap((row) => {
			const career = mapProgramToCareer(row.program_code);
			if (career === null) return [];
			return [
				{
					studentCode: row.student_code,
					lastName: row.last_name ?? '',
					firstName: row.first_name ?? '',
					programCode: career,
					campusCode: mapCampus(row.campus_code),
					enrollmentModalityTypeCode: DEFAULT_ENROLLMENT_STATUS,
				},
			];
		});
	}

	// Distinct (section, student) pairs from the latest Banner run. The Banner NRC doubles as the
	// section code (same namespace as the sections export), and the student code matches the
	// enrolled-students export (both Banner). Scoped by the school's careers when a school is active.
	async getAlumnosSecciones(schoolId: number | null): Promise<AlumnoSeccionExportRow[]> {
		const scope = await this.resolveScope(schoolId);
		const progFilter = scope ? `AND m.payload->'programa'->>'codigo' = ANY($1)` : '';
		const params = scope ? [scope.bannerPrograms] : [];

		const rows: Array<{ section_code: string; student_code: string }> = await this.dataSource.query(
			`
			SELECT DISTINCT m.nrc AS section_code, m.codigo_alumno AS student_code
			FROM raw_matricula m
			WHERE m.run_id = (SELECT id FROM scrape_run ORDER BY started_at DESC LIMIT 1)
			  AND NULLIF(trim(m.nrc), '') IS NOT NULL
			  AND NULLIF(trim(m.codigo_alumno), '') IS NOT NULL
			  ${progFilter}
			ORDER BY m.nrc, m.codigo_alumno
		`,
			params,
		);

		return rows.map((row) => ({ sectionCode: row.section_code, studentCode: row.student_code }));
	}
}
