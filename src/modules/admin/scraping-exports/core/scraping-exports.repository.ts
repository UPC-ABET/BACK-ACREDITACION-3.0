import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
	EnrolledStudentExportRow,
	SectionExportRow,
	StaffExportRow,
	StudentSectionExportRow,
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
 * (e.g. 1 → "202610", 2 → "202615"), which is exactly what scrape_run.period stores. Returns null
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

/**
 * Reverse of `resolveAcademicPeriodCode`: `scrape_run.period` (e.g. "202610") back to
 * `academic.academic_periods.id`. Used by the export generation orchestration, which only ever
 * has a `period` string in hand (from a completed scrape run), not the request-derived
 * `academicPeriodId` header — see docs/CONTEXT.md "scope must survive every asynchronous hop".
 */
export async function findAcademicPeriodIdByCode(
	mainDataSource: DataSource,
	periodCode: string,
): Promise<number | null> {
	const rows: Array<{ id: number }> = await mainDataSource.query(
		`SELECT id AS "id" FROM academic.academic_periods WHERE code = $1 LIMIT 1`,
		[periodCode],
	);
	return rows[0]?.id ?? null;
}

// Run to export from: the latest COMPLETED scrape_run for the given period code ($1). When $1 is
// NULL (no active period) it falls back to the latest completed run overall. The period code
// decides the modality — 202610/202620 are Regular, 202615/202625 are EPE — because Banner
// scrapes each into its own run. The status filter matters once retention deletes a superseded
// run's raw rows as soon as a new one completes (see design.md § AC-4/AC-5): without it, a
// manual regenerate racing a new in-flight scrape for the same period could read partial,
// still-being-inserted rows instead of falling back to the last good run.
const RUN_FOR_PERIOD = `(
	SELECT id FROM scrape_run
	WHERE ($1::text IS NULL OR period = $1)
	  AND status = 'completed'
	ORDER BY started_at DESC
	LIMIT 1
)`;

/**
 * Read side of the scraping-export feature. The raw tables live in the scraping DB ("exports-raw");
 * the active academic period is resolved against the main DB. Each export returns the full scrape
 * of the selected period (every career of that period/modality) — it is NOT scoped per school; the
 * per-career/program filtering happens on the upload side (audit.fn_validate_program_modality /
 * audit.fn_upload_enrolled_students validate each row's programCode against academic.programs). The
 * only narrowing kept here is dropping non-engineering programs from enrolled students
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

	async findAcademicPeriodIdByCode(periodCode: string): Promise<number | null> {
		return findAcademicPeriodIdByCode(this.mainDataSource, periodCode);
	}

	// Forward lookup used by the generic status/download/regenerate endpoints: given the request's
	// X-Academic-Period-Id header value, resolve the period code the export generation pipeline
	// (and scrape_run itself) is keyed on. Public wrapper around the same resolution the per-export
	// queries already use internally.
	async resolvePeriodCode(academicPeriodId: number): Promise<string | null> {
		return this.periodCode(academicPeriodId);
	}

	// Distinct teachers from the selected period's Banner run, taken straight from raw_horario's
	// docentes. professorCode = idBanner (the "N0…" user code the original system uses), and last
	// name / first name / email come from the same record.
	async getStaff(academicPeriodId: number | null): Promise<StaffExportRow[]> {
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
	async getSections(academicPeriodId: number | null): Promise<SectionExportRow[]> {
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
			  -- student-sections export enrolls students into.
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
	async getEnrolledStudents(academicPeriodId: number | null): Promise<EnrolledStudentExportRow[]> {
		const period = await this.periodCode(academicPeriodId);
		const rows: Array<{
			studentCode: string;
			lastName: string | null;
			firstName: string | null;
			programCode: string | null;
			campusCode: string | null;
		}> = await this.dataSource.query(
			`
			SELECT DISTINCT ON (a.student_code)
				a.student_code                    AS "studentCode",
				a.payload->>'apellidos'           AS "lastName",
				a.payload->>'nombres'             AS "firstName",
				a.payload->'programa'->>'codigo'  AS "programCode",
				a.payload->'campus'->>'codigo'    AS "campusCode"
			FROM raw_alumno a
			WHERE a.run_id = ${RUN_FOR_PERIOD}
			  AND NULLIF(trim(a.student_code), '') IS NOT NULL
			ORDER BY a.student_code
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
	// invariant ("un alumno una vez por curso") that the old load enforced.
	//
	// Scoped to the sections ALREADY UPLOADED to the app DB (academic.course_sections for the period):
	// students are only exported for sections that were previously loaded, so the student-sections upload
	// never references a section that isn't in the DB. The raw tables live in a separate connection, so
	// the uploaded section codes are fetched from the main DB and passed into the raw query.
	//
	// The malla (study plan) validation AND the one-per-course collapse run in a SINGLE main-DB pass,
	// keyed on the section's ACTUAL uploaded course (academic.course_sections.course_id) — NOT the raw
	// Banner course of the NRC. Banner reuses NRCs across runs, so a section's raw course can differ from
	// the course it was uploaded under; validating the real uploaded course is exactly what
	// audit.fn_upload_student_sections enforces, so the export can never emit a pair the upload would
	// reject. A (section, student) survives only when the section exists in course_sections, the student
	// is enrolled in a study plan for that period, and that plan contains the section's course — which
	// also drops phantom sections and non-enrolled students for free. The bounded raw matrícula (one row
	// per student-section, ~tens of thousands) is shipped to the main DB; no malla is materialized.
	async getStudentSections(academicPeriodId: number | null): Promise<StudentSectionExportRow[]> {
		const period = await this.periodCode(academicPeriodId);

		const uploaded: Array<{ sectionCode: string }> = await this.mainDataSource.query(
			`SELECT section_code AS "sectionCode" FROM academic.course_sections WHERE academic_period_id = $1`,
			[academicPeriodId],
		);
		const uploadedSectionCodes = uploaded.map((row) => row.sectionCode);
		if (uploadedSectionCodes.length === 0) return [];

		// Real Banner matrícula restricted to the sections already uploaded for this period. Uploaded
		// sections are the graded (calificable='Y') ones, so this is already ~one section per
		// student-course; `isGraded` is carried only to break ties deterministically in the collapse.
		const candidates: Array<{ sectionCode: string; studentCode: string; isGraded: boolean }> =
			await this.dataSource.query(
				`
				SELECT DISTINCT
					m.nrc                             AS "sectionCode",
					m.student_code                    AS "studentCode",
					(h.payload->>'calificable' = 'Y') AS "isGraded"
				FROM raw_matricula m
				JOIN raw_horario h ON h.run_id = m.run_id AND h.nrc = m.nrc
				WHERE m.run_id = ${RUN_FOR_PERIOD}
				  AND NULLIF(trim(m.nrc), '') IS NOT NULL
				  AND NULLIF(trim(m.student_code), '') IS NOT NULL
				  AND m.nrc = ANY($2::text[])
			`,
				[period, uploadedSectionCodes],
			);
		if (candidates.length === 0) return [];

		// Validate against the section's real uploaded course and collapse to one section per
		// (student, course) in a single pass. The candidate pairs are shipped to the main DB as parallel
		// arrays and intersected against course_sections + the student's study_plan_courses in SQL.
		const sectionCodes = candidates.map((row) => row.sectionCode);
		const studentCodes = candidates.map((row) => row.studentCode);
		const gradedFlags = candidates.map((row) => row.isGraded);

		const rows: StudentSectionExportRow[] = await this.mainDataSource.query(
			`
			WITH cand AS (
				SELECT section_code, student_code, is_graded
				FROM unnest($1::text[], $2::text[], $3::boolean[]) AS t(section_code, student_code, is_graded)
			),
			resolved AS (
				SELECT c.section_code, c.student_code, c.is_graded, cs.course_id
				FROM cand c
				JOIN academic.course_sections cs ON cs.section_code = c.section_code
				JOIN academic.students s ON s.code = c.student_code
				JOIN academic.enrolled_students es ON es.student_id = s.id
				JOIN academic.study_plan_academic_periods spap
					ON spap.id = es.study_plan_academic_period_id
					AND spap.academic_period_id = cs.academic_period_id
				JOIN academic.study_plan_courses spc
					ON spc.study_plan_academic_period_id = spap.id
					AND spc.course_id = cs.course_id
			),
			ranked AS (
				SELECT section_code, student_code,
					row_number() OVER (
						PARTITION BY student_code, course_id
						ORDER BY is_graded DESC NULLS LAST, section_code
					) AS rn
				FROM resolved
			)
			SELECT section_code AS "sectionCode", student_code AS "studentCode"
			FROM ranked
			WHERE rn = 1
			ORDER BY section_code, student_code
		`,
			[sectionCodes, studentCodes, gradedFlags],
		);

		return rows;
	}
}
