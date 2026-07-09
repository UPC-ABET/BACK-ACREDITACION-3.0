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
 * Resolve the active academic period id (X-Academic-Period-Id → academic_periods.id) to its code
 * (e.g. 1 → "202610", 2 → "202615"), which is exactly what scrape_run.periodo stores. Returns null
 * when no period is given or it doesn't resolve, in which case the exports fall back to the latest
 * run overall. Shared with the grades-rc export repository.
 */
export async function resolveAcademicPeriodCode(
	mainDataSource: DataSource,
	academicPeriodId: number | null,
): Promise<string | null> {
	if (academicPeriodId == null) return null;
	const rows: Array<{ code: string }> = await mainDataSource.query(
		`SELECT code FROM academic.academic_periods WHERE id = $1 LIMIT 1`,
		[academicPeriodId],
	);
	return rows[0]?.code ?? null;
}

// Run to export from: the latest scrape_run for the given period code ($1). When $1 is NULL (no
// active period) it falls back to the latest run overall. The period code decides the modality —
// 202610/202620 are Regular, 202615/202625 are EPE — because Banner scrapes each into its own run.
const RUN_FOR_PERIOD = `(
	SELECT id FROM scrape_run
	WHERE ($1::text IS NULL OR periodo = $1)
	ORDER BY started_at DESC
	LIMIT 1
)`;

/**
 * Read side of the scraping-export feature. The raw tables live in the scraping DB ("exports-raw");
 * the active academic period is resolved against the main DB. Each export returns the full scrape
 * of the selected period (every career of that period/modality) — it is NOT scoped per school; the
 * per-career/program filtering happens on the upload side (audit.fn_validate_program_modality /
 * audit.fn_upload_enrolled_students validate each row's programCode against academic.programs). The
 * only narrowing kept here is dropping non-engineering programs from matriculados
 * (mapProgramToCareer returns null for them). Reads only — never writes.
 */
@Injectable()
export class ScrapingExportsRepository {
	constructor(
		@InjectDataSource(EXPORTS_RAW_CONNECTION) private readonly dataSource: DataSource,
		@InjectDataSource() private readonly mainDataSource: DataSource,
	) {}

	private periodCode(academicPeriodId: number | null): Promise<string | null> {
		return resolveAcademicPeriodCode(this.mainDataSource, academicPeriodId);
	}

	// Distinct teachers from the selected period's Banner run, taken straight from raw_horario's
	// docentes. professorCode = idBanner (the "N0…" user code the original system uses), and last
	// name / first name / email come from the same record.
	async getDocentes(academicPeriodId: number | null): Promise<DocenteExportRow[]> {
		const period = await this.periodCode(academicPeriodId);
		const rows: Array<{
			professorCode: string;
			lastName: string | null;
			firstName: string | null;
			email: string | null;
		}> = await this.dataSource.query(
			`
			SELECT DISTINCT ON (d->>'idBanner')
				d->>'idBanner'  AS "professorCode",
				d->>'apellidos' AS "lastName",
				d->>'nombres'   AS "firstName",
				d->>'correo'    AS "email"
			FROM raw_horario h
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(h.payload->'horarios', '[]'::jsonb)) hr
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(hr->'docentes', '[]'::jsonb)) d
			WHERE h.run_id = ${RUN_FOR_PERIOD}
			  AND NULLIF(trim(d->>'idBanner'), '') IS NOT NULL
			ORDER BY d->>'idBanner'
		`,
			[period],
		);

		return rows.map((row) => ({
			professorCode: row.professorCode,
			lastName: row.lastName ?? '',
			firstName: row.firstName ?? '',
			email: row.email ?? '',
		}));
	}

	// One row per Banner section of the selected period, straight from raw_horario — same source the
	// original system uses. courseCode = materia.codigo + numeroCurso, sectionCode = nrc,
	// professorCode = the principal teacher's idBanner, campus = mapped Banner campus, modality =
	// Banner metodoEducativo (defaulting to "P" when missing).
	async getSecciones(academicPeriodId: number | null): Promise<SeccionExportRow[]> {
		const period = await this.periodCode(academicPeriodId);
		const rows: Array<{
			courseCode: string | null;
			sectionCode: string;
			professorCode: string | null;
			campusCode: string | null;
			modalityCode: string | null;
		}> = await this.dataSource.query(
			`
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
			WHERE h.run_id = ${RUN_FOR_PERIOD}
			  AND NULLIF(trim(h.nrc), '') IS NOT NULL
			  -- Legacy behaviour: only sections that carry their own teacher are exported. Practice/lab
			  -- sections without a docente in Banner are dropped (they are not loaded as sections).
			  AND prof.idb IS NOT NULL
			  -- Only the graded (calificable='Y') section of each course is exported — the accreditation
			  -- model keeps a single loadable section per course (the theory), matching the one the
			  -- alumno-seccion export enrolls students into.
			  AND h.payload->>'calificable' = 'Y'
			ORDER BY h.nrc
		`,
			[period],
		);

		return rows.map((row) => ({
			courseCode: row.courseCode ?? '',
			sectionCode: row.sectionCode,
			professorCode: row.professorCode ?? '',
			campusCode: mapCampus(row.campusCode),
			sectionModalityTypeCode: row.modalityCode ?? DEFAULT_SECTION_MODALITY,
		}));
	}

	// Distinct enrolled students from the selected period's Banner run. The program is mapped to its
	// academic career code (SW/CC/CIVAC/CIVFC…), the campus to the short code, and the enrollment
	// column is hardcoded to "P" for now. Every engineering student is kept; non-engineering programs
	// are dropped by mapProgramToCareer (the only filtering left — the rest happens on upload).
	async getAlumnosMatriculados(
		academicPeriodId: number | null,
	): Promise<AlumnoMatriculadoExportRow[]> {
		const period = await this.periodCode(academicPeriodId);
		const rows: Array<{
			studentCode: string;
			lastName: string | null;
			firstName: string | null;
			programCode: string | null;
			campusCode: string | null;
		}> = await this.dataSource.query(
			`
			SELECT DISTINCT ON (a.codigo_alumno)
				a.codigo_alumno                   AS "studentCode",
				a.payload->>'apellidos'           AS "lastName",
				a.payload->>'nombres'             AS "firstName",
				a.payload->'programa'->>'codigo'  AS "programCode",
				a.payload->'campus'->>'codigo'    AS "campusCode"
			FROM raw_alumno a
			WHERE a.run_id = ${RUN_FOR_PERIOD}
			  AND NULLIF(trim(a.codigo_alumno), '') IS NOT NULL
			ORDER BY a.codigo_alumno
		`,
			[period],
		);

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

	// One (section, student) pair per COURSE — as the legacy system did. In Banner a student is enrolled
	// in every component of a course (theory + practice/lab, each its own NRC), but the accreditation
	// model keeps a single enrollment per course: the graded section. So for each (student, course) we
	// keep the section flagged calificable='Y' (the theory); ties break by NRC. This mirrors the legacy
	// invariant ("un alumno una vez por curso") that the old load enforced. Course = materia.codigo +
	// numeroCurso, same key the sections export uses.
	//
	// Scoped to the sections ALREADY UPLOADED to the app DB (academic.course_sections for the period):
	// students are only exported for sections that were previously loaded, so the alumno-seccion upload
	// never references a section that isn't in the DB. The raw tables live in a separate connection, so
	// the uploaded section codes are fetched from the main DB and passed into the raw query.
	async getAlumnosSecciones(academicPeriodId: number | null): Promise<AlumnoSeccionExportRow[]> {
		const period = await this.periodCode(academicPeriodId);

		const uploaded: Array<{ sectionCode: string }> = await this.mainDataSource.query(
			`SELECT section_code AS "sectionCode" FROM academic.course_sections WHERE academic_period_id = $1`,
			[academicPeriodId],
		);
		const uploadedSectionCodes = uploaded.map((row) => row.sectionCode);
		if (uploadedSectionCodes.length === 0) return [];

		const rows: Array<{ sectionCode: string; studentCode: string }> = await this.dataSource.query(
			`
			WITH matricula AS (
				SELECT DISTINCT
					m.codigo_alumno,
					m.nrc,
					(h.payload->'materia'->>'codigo') || (h.payload->>'numeroCurso') AS curso,
					h.payload->>'calificable'                                        AS calificable
				FROM raw_matricula m
				JOIN raw_horario h ON h.run_id = m.run_id AND h.nrc = m.nrc
				WHERE m.run_id = ${RUN_FOR_PERIOD}
				  AND NULLIF(trim(m.nrc), '') IS NOT NULL
				  AND NULLIF(trim(m.codigo_alumno), '') IS NOT NULL
				  AND m.nrc = ANY($2::text[])
			),
			ranked AS (
				SELECT
					codigo_alumno,
					nrc,
					row_number() OVER (
						PARTITION BY codigo_alumno, curso
						ORDER BY (calificable = 'Y') DESC NULLS LAST, nrc
					) AS rn
				FROM matricula
			)
			SELECT nrc AS "sectionCode", codigo_alumno AS "studentCode"
			FROM ranked
			WHERE rn = 1
			ORDER BY nrc, codigo_alumno
		`,
			[period, uploadedSectionCodes],
		);

		return rows.map((row) => ({ sectionCode: row.sectionCode, studentCode: row.studentCode }));
	}
}
