/**
 * Behavioural verification of GRADES_RC_SQL (the Planner-sourced merge, plus a Banner-sourced
 * raw_alumno careerCode lookup, behind GET /scraping/exports/grades-rc — see ADR-005 for why
 * Banner's own grades scraping was retired from this merge). The merge, the "newest scrape wins"
 * rule, the dedup, the designated/fallback pick and the status classification are SQL, so they
 * can only be proven against a real Postgres — the jest suite mocks `query` and never executes
 * them.
 *
 * It TRUNCATEs both run tables before loading its fixtures, and the raw_* tables cascade off them,
 * so pointing it at the real scraping database costs a full re-scrape of Banner (for raw_alumno)
 * and Planner (for the grades themselves) — hours, credentials, and data that exists nowhere else.
 * Three guards stand in the way, in increasing order of how much they actually prove:
 *
 *  1. VERIFY_DB_URL must be set explicitly. There is no default, so nothing happens by accident.
 *  2. VERIFY_DB_URL must not resolve to the same server and database as RAW_DB_URL — compared by
 *     host, port and database name, NOT as strings, because "localhost" and "127.0.0.1" (or a
 *     trailing slash, or an added ?sslmode) are the same database spelled two ways. RAW_DB_URL is
 *     REQUIRED for this reason: with it unset there is nothing to compare against, and a guard that
 *     silently skips itself is worse than none.
 *  3. The target must not already hold more than a handful of scraped rows. This is the one that
 *     holds when the other two are defeated: a real scrape is millions of rows, so refusing to
 *     truncate a populated database catches the case where the URL is wrong in a way the parse
 *     cannot see (a pgbouncer alias, a tunnelled port, a replica).
 *
 *   docker run -d --rm --name abet-rc-verify -e POSTGRES_PASSWORD=postgres \
 *     -e POSTGRES_DB=rawverify -p 55433:5432 postgres:16
 *   RAW_DB_URL=postgres://postgres:postgres@localhost:55433/rawverify pnpm migration:raw:run
 *   VERIFY_DB_URL=postgres://postgres:postgres@localhost:55433/rawverify \
 *     npx ts-node -T -r tsconfig-paths/register test/manual/grades-rc-export.verify.ts
 *
 * The export emits AT MOST ONE row per (section, student) — the grade of the course's designated
 * type — so every property below is checked on that single row. A section that wants to exercise
 * the merge has to be designated with the type the merge is being tested on; that is why each
 * section here carries one behaviour rather than one student carrying several.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';

import {
	DROP_NOT_IN_SECTION_COLUMN_SQL,
	GRADES_RC_TEMP_TABLE,
	INDEX_GRADES_RC_TEMP_SQL,
	MATERIALIZE_GRADES_RC_SQL,
	NOT_IN_SECTION_CANDIDATES_SQL,
	PRUNE_GRADES_RC_UNRESOLVED_SQL,
	READ_GRADES_RC_ALL_PAGE_SQL,
} from 'src/modules/admin/scraping-exports/core/grades-rc-export.sql';
import { GRADE_RC_OBSERVATIONS } from 'src/modules/admin/scraping-exports/model/scraping-exports.types';
import { PROGRAM_CAREER_MAP } from 'src/modules/admin/scraping-exports/model/scraping-exports.transforms';

dotenv.config();

const BANNER_RUN = '11111111-1111-1111-1111-111111111111';
const PLANNER_RUN = '33333333-3333-3333-3333-333333333333';
const PLANNER_UNFINISHED_RUN = '44444444-4444-4444-4444-444444444444';

const OLDER_SCRAPE = '2026-08-01T10:00:00Z';
const NEWER_SCRAPE = '2026-08-02T10:00:00Z';

const GRADE_TYPES: Record<string, string> = {
	EA1: 'TG205-T001',
	EB1: 'TG205-T002',
	PA: 'TG205-T003',
	TA: 'TG205-T004',
	TB1: 'TG205-T005',
	PC1: 'TG205-T008',
};
const QUALIFICATION_STATUSES: Record<string, string> = {
	ASISTIO: 'TG404-T001',
	NR: 'TG404-T002',
	RET: 'TG404-T005',
	SAN: 'TG404-T006',
};

// section -> grade type designated by a study plan of the period (academic.study_plan_courses).
// NRC5 and NRC7 are deliberately absent: an unconfigured section arms the fallback.
const DESIGNATED: Array<[string, string]> = [
	['NRC1', 'TG205-T001'],
	['NRC2', 'TG205-T008'],
	['NRC3', 'TG205-T002'],
	['NRC4', 'TG205-T005'],
	// Designated by TWO study plans with different types, and both types are actually graded in the
	// section: the code, the name and the weight exported for a student who has neither must all
	// come from the SAME one of them.
	['NRC6', 'TG205-T001'],
	['NRC6', 'TG205-T002'],
	['NRC8', 'TG205-T001'],
	['NRC9', 'TG205-T001'],
	['NRC11', 'TG205-T008'],
	['NRC12', 'TG205-T005'],
	['NRC13', 'TG205-T001'],
	['NRC14', 'TG205-T001'],
];

// academic.course_sections for the period. NRC9 is deliberately missing: its grades have nowhere to
// land, so they must not reach either worksheet. NRC1B is loaded and shares NRC1's course, which is
// what the dedup collapses.
const LOADED_SECTIONS = [
	'NRC1',
	'NRC1B',
	'NRC2',
	'NRC3',
	'NRC4',
	'NRC5',
	'NRC6',
	'NRC7',
	'NRC8',
	'NRC11',
	'NRC12',
	'NRC13',
	'NRC14',
];

// Sections whose course carries a CONTROL outcome (TG302-T002) in the period's study plan. NRC14 is
// loaded, designated, enrolled and graded, and is deliberately absent here: only the missing control
// mapping stands between it and the export, so nothing else can explain its rows disappearing.
const CONTROL_SECTIONS = LOADED_SECTIONS.filter((section) => section !== 'NRC14');

// What the repository actually binds: the two scopes intersected before the query, never ANDed as
// two arrays inside it -- see the $10 note in GRADES_RC_SQL.
const SCOPED_SECTIONS = LOADED_SECTIONS.filter((section) => CONTROL_SECTIONS.includes(section));

// academic.student_section_enrollments for the period. (NRC1, A1B) is deliberately missing: A1B is
// still a matriculado (PERIOD_ENROLLED below), just not paired to NRC1.
const ENROLLED: Array<[string, string]> = [
	['NRC1', 'A1'],
	['NRC1', 'A1C'],
	['NRC1', 'A1D'],
	['NRC2', 'A2'],
	['NRC3', 'A3'],
	['NRC4', 'A4'],
	['NRC5', 'A5'],
	['NRC6', 'A6'],
	['NRC6', 'A6B'],
	['NRC6', 'A6C'],
	['NRC7', 'A7'],
	['NRC8', 'A8'],
	['NRC8', 'A8B'],
	['NRC11', 'A11'],
	['NRC11', 'A11B'],
	['NRC12', 'A12'],
	['NRC13', 'A13'],
	['NRC14', 'A14'],
];

// academic.enrolled_students for the period. A1E is absent from both this and ENROLLED (never
// matriculated); A1F IS matriculado but, like A1B, absent from ENROLLED -- split by IN_STUDY_PLAN.
const PERIOD_ENROLLED: string[] = [
	...new Set(ENROLLED.map(([, student]) => student)),
	'A1B',
	'A1F',
];

// academic.study_plan_courses pairs, pinned to the student's own plan revision. A1B: course IS on
// their plan, so their grade still ships flagged. A1F: same shape but course is NOT on their plan
// (absent here too), so it is dropped entirely instead.
const IN_STUDY_PLAN: Array<[string, string]> = [['NRC1', 'A1B']];

interface ExportedRow {
	sectionCode: string;
	studentCode: string;
	gradeTypeCode: string;
	gradeTypePercentage: string;
	grade: string;
	qualificationStatusCode: string;
	gradeTypeName: string;
	careerCode: string;
	source: string;
	observations: string[];
}

// Two URLs point at the same database when the server and the database name match; the user, the
// password, the SSL mode and how the host happens to be spelled are not part of that identity.
const DEFAULT_PG_PORT = '5432';
const LOOPBACK_ALIASES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

interface DatabaseTarget {
	host: string;
	port: string;
	database: string;
}

function describeTarget(url: string, label: string): DatabaseTarget {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error(`${label} is not a valid connection URL.`);
	}
	const host = parsed.hostname.toLowerCase();
	return {
		host: LOOPBACK_ALIASES.has(host) ? 'localhost' : host,
		port: parsed.port || DEFAULT_PG_PORT,
		database: decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase(),
	};
}

function resolveConnectionString(): string {
	const url = process.env.VERIFY_DB_URL;
	if (!url) throw new Error('VERIFY_DB_URL is required: point it at a throwaway database.');

	// Required, not optional: `if (RAW_DB_URL && ...)` would disable the whole check whenever the
	// variable happens to be missing -- which is exactly when someone is running with an unfamiliar
	// environment and most likely to have the URL wrong.
	const raw = process.env.RAW_DB_URL;
	if (!raw) {
		throw new Error(
			'RAW_DB_URL must be set so this script can prove VERIFY_DB_URL is not pointing at it.',
		);
	}

	const target = describeTarget(url, 'VERIFY_DB_URL');
	const real = describeTarget(raw, 'RAW_DB_URL');
	if (target.host === real.host && target.port === real.port && target.database === real.database) {
		throw new Error(
			`VERIFY_DB_URL resolves to the real scraping database ` +
				`(${real.host}:${real.port}/${real.database}): this script truncates it.`,
		);
	}
	return url;
}

// A real scrape is millions of rows and the fixtures below are a few dozen, so anything beyond this
// is data this script did not put there. Deliberately a floor rather than an exact count: re-runs
// find their own fixtures still in place, and the point is only to tell "throwaway" from "someone's
// data" without needing to be right about which.
const MAX_PREEXISTING_ROWS = 500;

async function assertThrowaway(db: Client): Promise<void> {
	// raw_notas is deliberately NOT checked here -- ADR-005 retired it, so a post-migration
	// VERIFY_DB_URL correctly does not have it.
	const { rows: schema } = await db.query<{ present: boolean }>(
		`SELECT (to_regclass('public.raw_planner_nota') IS NOT NULL) AS present`,
	);
	if (!schema[0]?.present) {
		throw new Error(
			'The raw tables are missing: run `pnpm migration:raw:run` against VERIFY_DB_URL first.',
		);
	}

	const { rows: counted } = await db.query<{ total: string }>(
		`SELECT count(*) AS total FROM raw_planner_nota`,
	);
	const total = Number(counted[0]?.total ?? 0);
	if (total > MAX_PREEXISTING_ROWS) {
		throw new Error(
			`Refusing to truncate: the target already holds ${total} scraped rows, so it is not a ` +
				'throwaway database. Check VERIFY_DB_URL.',
		);
	}
}

async function loadFixtures(db: Client): Promise<void> {
	await db.query(`TRUNCATE scrape_run, planner_scrape_run CASCADE`);
	await db.query(
		`INSERT INTO scrape_run (id, period, level, departments, status, started_at)
		 VALUES ($1, '202610', 'UG', '{ISW}', 'completed', $2)`,
		[BANNER_RUN, OLDER_SCRAPE],
	);
	await db.query(
		`INSERT INTO planner_scrape_run (id, period, status, started_at) VALUES
			($1, '202610', 'completed', $3),
			($2, '202610', 'running',   $4)`,
		[PLANNER_RUN, PLANNER_UNFINISHED_RUN, OLDER_SCRAPE, NEWER_SCRAPE],
	);

	// raw_alumno is where the student's name and Banner program live -- populated by scrapeStudents,
	// independent of grades scraping (see ADR-005), so this is untouched by the Banner-leg removal.
	// Only Banner has it, so a student who exists solely in Planner has neither -- which is a case
	// the assertions cover.
	const alumno = (studentCode: string, programCode: string | null) =>
		db.query(
			`INSERT INTO raw_alumno (run_id, level, student_code, payload, payload_hash)
			 VALUES ($1, 'UG', $2, $3::jsonb, repeat('0', 64))`,
			[
				BANNER_RUN,
				studentCode,
				JSON.stringify({
					apellidos: `Apellido${studentCode}`,
					nombres: `Nombre${studentCode}`,
					...(programCode ? { programa: { codigo: programCode } } : {}),
				}),
			],
		);

	const seccion = (sectionId: string, nrc: string, courseCode?: string) =>
		db.query(
			`INSERT INTO raw_planner_seccion (run_id, period, section_id, payload, payload_hash)
			 VALUES ($1, '202610', $2, $3::jsonb, repeat('0', 64))`,
			[
				PLANNER_RUN,
				sectionId,
				JSON.stringify({
					sectionId: Number(sectionId),
					sectionNumber: nrc,
					...(courseCode ? { courses: [{ courseCode, courseName: `Course ${courseCode}` }] } : {}),
				}),
			],
		);
	const evaluacion = (sectionId: string, componentId: string, payload: Record<string, unknown>) =>
		db.query(
			`INSERT INTO raw_planner_evaluacion (run_id, section_id, eval_component_id, payload, payload_hash)
			 VALUES ($1, $2, $3, $4::jsonb, repeat('0', 64))`,
			[PLANNER_RUN, sectionId, componentId, JSON.stringify(payload)],
		);
	const notaPlanner = (
		sectionId: string,
		componentId: string,
		studentCode: string,
		payload: Record<string, unknown>,
		options: { scrapedAt?: string; runId?: string } = {},
	) =>
		db.query(
			`INSERT INTO raw_planner_nota
				(run_id, section_id, component_id, student_code, payload, payload_hash, scraped_at)
			 VALUES ($1, $2, $3, $4, $5::jsonb, repeat('0', 64), $6)`,
			[
				options.runId ?? PLANNER_RUN,
				sectionId,
				componentId,
				studentCode,
				JSON.stringify(payload),
				options.scrapedAt ?? OLDER_SCRAPE,
			],
		);

	// A1 -> SW and A2 -> CC are in PROGRAM_CAREER_MAP; A5's program is a real Banner code that is
	// NOT in the map (a non-engineering program), and A7 has no raw_alumno row at all because it
	// only exists in Planner.
	for (const [student, program] of [
		['A1', 'UAC_ISOF_SP1'],
		['A1B', 'UAC_ISOF_SP1'],
		['A1C', 'UAC_ISOF_SP1'],
		['A1D', 'UAC_ISOF_SP1'],
		['A2', 'UAC_COMP_SP1'],
		['A3', 'UAC_ICIV_SP1'],
		['A5', 'UAC_ADMI_SP1'],
		['A6', 'UAC_ISOF_SP1'],
		['A6B', 'UAC_ISOF_SP1'],
		['A6C', 'UAC_ISOF_SP1'],
		['A8', 'UAC_ISOF_SP1'],
		['A8B', 'UAC_ISOF_SP1'],
	] as Array<[string, string]>) {
		await alumno(student, program);
	}

	// NRC1 (designated EA1): three of A1's evaluations must collapse to the one designated row.
	await seccion('900010', 'NRC1', '1ASI1');
	await evaluacion('900010', 'C_EA1', {
		evalComponentCode: 'EA1',
		percentage: 20,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await evaluacion('900010', 'C_PA1', {
		evalComponentCode: 'PA',
		percentage: 10,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 4,
		componentTypeId: 1,
	});
	await evaluacion('900010', 'C_TA1', {
		evalComponentCode: 'TA',
		percentage: 10,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 5,
		componentTypeId: 1,
	});
	await notaPlanner('900010', 'C_EA1', 'A1', {
		grade: 14.8,
		gradeFormat: '14.80',
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900010', 'C_PA1', 'A1', {
		grade: 12,
		gradeFormat: '12.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900010', 'C_TA1', 'A1', {
		grade: 13,
		gradeFormat: '13.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	// A1B: matriculado but missing from THIS section's pairing -- see ENROLLED/IN_STUDY_PLAN below.
	await notaPlanner('900010', 'C_EA1', 'A1B', {
		grade: 11,
		gradeFormat: '11.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	// A1E: never matriculated at all -- see PERIOD_ENROLLED below.
	await notaPlanner('900010', 'C_EA1', 'A1E', {
		grade: 9,
		gradeFormat: '9.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	// A1F: matriculado, but NRC1's course is not on their study plan -- see IN_STUDY_PLAN below.
	await notaPlanner('900010', 'C_EA1', 'A1F', {
		grade: 8,
		gradeFormat: '8.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	// Designated grade that is a known TG404 status instead of a number, and one whose text is not a
	// status at all -- reached the same way Planner reaches any unstructured grade text: status_raw
	// stays null (no statusName/markType/isSanctioned set) and status_text falls back to the
	// non-numeric grade itself.
	await notaPlanner('900010', 'C_EA1', 'A1C', {
		grade: 'RET',
		gradeFormat: 'RET',
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900010', 'C_EA1', 'A1D', {
		grade: 'XXX',
		gradeFormat: 'XXX',
		isFinal: 0,
		isSanctioned: 0,
	});
	// Same student, same designated grade, on an unfinished Planner run: must lose to the completed
	// one -- planner_run only ever resolves to the completed run's id, so this row is excluded
	// regardless of its (deliberately newer) scraped_at.
	await notaPlanner(
		'900010',
		'C_EA1',
		'A1',
		{ grade: 99, gradeFormat: '99.00', isFinal: 0, isSanctioned: 0 },
		{ scrapedAt: NEWER_SCRAPE, runId: PLANNER_UNFINISHED_RUN },
	);

	// NRC1B: A1 enrolled/graded in a second loaded section of the SAME course -- the dedup collapses
	// it (NRC1 wins: 'NRC1' < 'NRC1B' alphabetically).
	await seccion('900011', 'NRC1B', '1ASI1');
	await evaluacion('900011', 'C_EA1B', {
		evalComponentCode: 'EA1',
		percentage: 20,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await notaPlanner('900011', 'C_EA1B', 'A1', {
		grade: 11,
		gradeFormat: '11.00',
		isFinal: 0,
		isSanctioned: 0,
	});

	// NRC2 (designated PC1): a later Planner scrape of the same evaluation replaces an earlier one.
	await seccion('900001', 'NRC2');
	await evaluacion('900001', '338001', {
		evalComponentCode: 'PC1',
		evalComponentName: 'Práctica Calificada 1',
		percentage: 15,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 2,
		componentTypeId: 1,
	});
	await notaPlanner(
		'900001',
		'338001',
		'A2',
		{ grade: 12, gradeFormat: '12.00', isFinal: 0, isSanctioned: 0 },
		{ scrapedAt: NEWER_SCRAPE },
	);

	// NRC3 (designated EB1): a single Planner value.
	await seccion('900002', 'NRC3');
	await evaluacion('900002', '338011', {
		evalComponentCode: 'EB1',
		evalComponentName: 'Evaluación Final 1',
		percentage: 20,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 3,
		componentTypeId: 1,
	});
	await notaPlanner(
		'900002',
		'338011',
		'A3',
		{ grade: 16, gradeFormat: '16.00', isFinal: 0, isSanctioned: 0 },
		{ scrapedAt: NEWER_SCRAPE },
	);

	// NRC4 (designated TB1). The computed "Nota Final" alongside it must be dropped.
	await seccion('900003', 'NRC4');
	await evaluacion('900003', '338021', {
		evalComponentCode: 'TB1',
		evalComponentName: 'Trabajo 1',
		percentage: 25,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 4,
		componentTypeId: 1,
	});
	await evaluacion('900003', '338022', {
		evalComponentCode: 'NF',
		evalComponentName: 'Nota Final',
		formula: '0.2 * TB1',
		percentage: 100,
		isFinal: 1,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 2,
	});
	await notaPlanner('900003', '338021', 'A4', {
		grade: 17,
		gradeFormat: '17.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900003', '338022', 'A4', {
		grade: 15,
		gradeFormat: '15.00',
		isFinal: 1,
		isSanctioned: 0,
	});

	// NRC5: unconfigured -> the fallback rescues the last evaluation with its raw, unregistered code.
	await seccion('900012', 'NRC5');
	await evaluacion('900012', 'C_TA5', {
		evalComponentCode: 'TA',
		percentage: 40,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await evaluacion('900012', 'C_ZZ1', {
		evalComponentCode: 'ZZ1',
		percentage: 60,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 3,
		componentTypeId: 1,
	});
	await notaPlanner('900012', 'C_TA5', 'A5', {
		grade: 12,
		gradeFormat: '12.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900012', 'C_ZZ1', 'A5', {
		grade: 15,
		gradeFormat: '15.00',
		isFinal: 0,
		isSanctioned: 0,
	});

	// NRC6 (designated EA1 AND EB1, both graded, with weights where a text max() would cross them:
	// '5' > '20'). A6C has neither and must get one consistent (code, name, weight) triple.
	await seccion('900013', 'NRC6');
	await evaluacion('900013', 'C_EB16', {
		evalComponentCode: 'EB1',
		percentage: 20,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 2,
		componentTypeId: 1,
	});
	await evaluacion('900013', 'C_EA16', {
		evalComponentCode: 'EA1',
		percentage: 5,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await evaluacion('900013', 'C_QQ26', {
		evalComponentCode: 'QQ2',
		percentage: 80,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 8,
		componentTypeId: 1,
	});
	await notaPlanner('900013', 'C_EB16', 'A6', {
		grade: 14,
		gradeFormat: '14.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900013', 'C_EA16', 'A6B', {
		grade: 13,
		gradeFormat: '13.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900013', 'C_QQ26', 'A6C', {
		grade: 17,
		gradeFormat: '17.00',
		isFinal: 0,
		isSanctioned: 0,
	});

	// NRC7: unconfigured -> fallback. The last evaluation resolves through no component id and is
	// matched by evaluation name instead; the ungraded, silent one says nothing and is dropped.
	await seccion('900004', 'NRC7');
	await evaluacion('900004', '338031', {
		evalComponentCode: 'TB1',
		evalComponentName: 'Trabajo 2',
		percentage: 30,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await evaluacion('900004', '338032', {
		evalComponentCode: 'PC1',
		evalComponentName: 'Práctica Calificada 1',
		percentage: 20,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 2,
		componentTypeId: 1,
	});
	await evaluacion('900004', '338033', {
		evalComponentCode: 'EA1',
		evalComponentName: 'Evaluación Parcial 1',
		percentage: 50,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 3,
		componentTypeId: 1,
	});
	await notaPlanner('900004', '338031', 'A7', {
		grade: null,
		gradeFormat: null,
		isFinal: 0,
		isSanctioned: 0,
		statusName: 'NR',
	});
	await notaPlanner('900004', '338032', 'A7', {
		grade: null,
		gradeFormat: null,
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900004', '999999', 'A7', {
		evaluation: 'Evaluación Parcial 1',
		grade: 18,
		gradeFormat: '18.00',
		isFinal: 0,
		isSanctioned: 0,
	});

	// NRC8 (designated EA1): A8 lacks it but is withdrawn from the course (a structured Planner
	// status, not overloaded grade text), which explains it.
	await seccion('900014', 'NRC8');
	await evaluacion('900014', 'C_TB18', {
		evalComponentCode: 'TB1',
		percentage: 30,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 2,
		componentTypeId: 1,
	});
	await evaluacion('900014', 'C_PA8', {
		evalComponentCode: 'PA',
		percentage: 10,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 4,
		componentTypeId: 1,
	});
	await evaluacion('900014', 'C_EA18', {
		evalComponentCode: 'EA1',
		percentage: 70,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await notaPlanner('900014', 'C_TB18', 'A8', {
		grade: 12,
		gradeFormat: '12.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900014', 'C_PA8', 'A8', {
		grade: null,
		gradeFormat: null,
		isFinal: 0,
		isSanctioned: 0,
		statusName: 'RET',
	});
	await notaPlanner('900014', 'C_EA18', 'A8B', {
		grade: 15,
		gradeFormat: '15.00',
		isFinal: 0,
		isSanctioned: 0,
	});

	// NRC9 is not in academic.course_sections: nothing of it may be exported.
	await seccion('900015', 'NRC9');
	await evaluacion('900015', 'C_EA19', {
		evalComponentCode: 'EA1',
		percentage: 100,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await notaPlanner('900015', 'C_EA19', 'A9', {
		grade: 19,
		gradeFormat: '19.00',
		isFinal: 0,
		isSanctioned: 0,
	});

	// NRC11 (designated PC1): the designated evaluation is still open, so A11B's missing grade is
	// pending rather than unexplained.
	await seccion('900005', 'NRC11');
	await evaluacion('900005', '338041', {
		evalComponentCode: 'PC1',
		evalComponentName: 'Práctica Calificada 1',
		percentage: 40,
		isFinal: 0,
		isSubmitted: 0,
		orderEvaluation: 2,
		componentTypeId: 1,
	});
	await evaluacion('900005', '338042', {
		evalComponentCode: 'TB1',
		evalComponentName: 'Trabajo 1',
		percentage: 60,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await notaPlanner('900005', '338041', 'A11', {
		grade: 14,
		gradeFormat: '14.00',
		isFinal: 0,
		isSanctioned: 0,
	});
	await notaPlanner('900005', '338042', 'A11B', {
		grade: 10,
		gradeFormat: '10.00',
		isFinal: 0,
		isSanctioned: 0,
	});

	// NRC12 (designated TB1): the designated grade itself is a sanction, not a number -- and the
	// sanction has to win even against a NEWER, numeric competitor from the SAME source (a second
	// evaluation resolving to the same raw_type). newest-scrape-wins only applies within a tier.
	await seccion('900006', 'NRC12');
	await evaluacion('900006', '338051', {
		evalComponentCode: 'TB1',
		evalComponentName: 'Trabajo 1',
		percentage: 100,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await evaluacion('900006', '338052', {
		evalComponentCode: 'TB1',
		evalComponentName: 'Trabajo 1 (re-evaluado)',
		percentage: 100,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await notaPlanner('900006', '338051', 'A12', {
		grade: null,
		gradeFormat: null,
		isFinal: 0,
		isSanctioned: 1,
	});
	await notaPlanner(
		'900006',
		'338052',
		'A12',
		{ grade: 15, gradeFormat: '15.00', isFinal: 0, isSanctioned: 0 },
		{ scrapedAt: NEWER_SCRAPE },
	);

	// NRC13 (designated EA1): the designated type IS present, so nothing is "missing", but its grade
	// is blank and no status explains it. The grade key is present-but-empty, not null: has_grade is
	// true whenever the key exists at all, so this still clears planner_legs's WHERE (has_grade OR
	// status_raw IS NOT NULL) -- a null grade key would drop the row entirely.
	await seccion('900016', 'NRC13');
	await evaluacion('900016', 'C_EA113', {
		evalComponentCode: 'EA1',
		percentage: 100,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await notaPlanner('900016', 'C_EA113', 'A13', {
		grade: '',
		gradeFormat: '',
		isFinal: 0,
		isSanctioned: 0,
	});

	// NRC14: a perfectly exportable grade whose course is mapped to no CONTROL outcome.
	await seccion('900017', 'NRC14');
	await evaluacion('900017', 'C_EA114', {
		evalComponentCode: 'EA1',
		percentage: 100,
		isFinal: 0,
		isSubmitted: 1,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await notaPlanner('900017', 'C_EA114', 'A14', {
		grade: 16,
		gradeFormat: '16.00',
		isFinal: 0,
		isSanctioned: 0,
	});
}

function assertions(rows: ExportedRow[]): Array<[string, boolean]> {
	const key = (row: ExportedRow) => `${row.sectionCode}|${row.studentCode}`;
	const byKey = new Map(rows.map((row) => [key(row), row]));
	const of = (k: string) => byKey.get(k);
	const inSection = (section: string) => rows.filter((row) => row.sectionCode === section);
	const has = (k: string, observation: string) => (of(k)?.observations ?? []).includes(observation);

	return [
		['one row per (section, student) at most', new Set(rows.map(key)).size === rows.length],
		[
			'R6 only the designated grade ships, not every evaluation',
			inSection('NRC1').every((row) => row.gradeTypeCode === 'TG205-T001'),
		],
		['R4 designated grade only Planner has', of('NRC4|A4')?.grade === '17.00'],
		['R4 both sources agree -> one row', inSection('NRC3').length === 1],
		['R4 sources disagree -> newest scrape wins', of('NRC2|A2')?.grade === '12.00'],
		['R4 the winning row brings its own weight', of('NRC2|A2')?.gradeTypePercentage === '15'],
		['R1 unfinished run ignored', of('NRC1|A1')?.grade !== '99.00'],
		[
			'R2 same course in two loaded sections -> the student appears once',
			rows.filter((row) => row.studentCode === 'A1').length === 1,
		],
		['R2 section outside academic.course_sections dropped', inSection('NRC9').length === 0],
		['R2 section whose course has no CONTROL outcome dropped', inSection('NRC14').length === 0],
		['R7 numeric grade -> ASISTIO', of('NRC1|A1')?.qualificationStatusCode === 'TG404-T001'],
		[
			'R7 non-numeric designated grade -> 0 + known TG404 code',
			of('NRC1|A1C')?.grade === '0' && of('NRC1|A1C')?.qualificationStatusCode === 'TG404-T005',
		],
		['R7 unknown status text passed through', of('NRC1|A1D')?.qualificationStatusCode === 'XXX'],
		[
			'R7 an unregistered status is flagged for review',
			has('NRC1|A1D', GRADE_RC_OBSERVATIONS.UNREGISTERED_STATUS) &&
				!has('NRC1|A1', GRADE_RC_OBSERVATIONS.UNREGISTERED_STATUS) &&
				!has('NRC1|A1C', GRADE_RC_OBSERVATIONS.UNREGISTERED_STATUS),
		],
		[
			'R7 sanctioned designated grade -> 0 + SAN',
			of('NRC12|A12')?.grade === '0' && of('NRC12|A12')?.qualificationStatusCode === 'TG404-T006',
		],
		[
			'R7 a course-level status beats a newer numeric grade of the same evaluation type',
			of('NRC12|A12')?.grade === '0' && of('NRC12|A12')?.qualificationStatusCode === 'TG404-T006',
		],
		[
			'R7 a defaulted status is flagged, so a 0 the source never stated cannot reach the upload sheet',
			of('NRC13|A13')?.grade === '0' &&
				of('NRC13|A13')?.qualificationStatusCode === QUALIFICATION_STATUSES.NR &&
				has('NRC13|A13', GRADE_RC_OBSERVATIONS.NO_SOURCE_GRADE_OR_STATUS),
		],
		[
			'R7 a stated status is not flagged as defaulted',
			!has('NRC1|A1D', GRADE_RC_OBSERVATIONS.NO_SOURCE_GRADE_OR_STATUS) &&
				!has('NRC6|A6C', GRADE_RC_OBSERVATIONS.NO_SOURCE_GRADE_OR_STATUS) &&
				!has('NRC12|A12', GRADE_RC_OBSERVATIONS.NO_SOURCE_GRADE_OR_STATUS),
		],
		[
			'R7 a course-level status suppresses the fallback observation',
			has('NRC12|A12', GRADE_RC_OBSERVATIONS.COURSE_LEVEL_STATUS) &&
				!has('NRC12|A12', GRADE_RC_OBSERVATIONS.FALLBACK_GRADE),
		],
		['R3 computed final grade excluded', !rows.some((row) => row.gradeTypeName === 'NF')],
		['R3 ungraded silent evaluation excluded', of('NRC7|A7')?.grade === '18.00'],
		[
			'R3 evaluation matched by name when the id misses',
			of('NRC7|A7')?.gradeTypeCode === 'TG205-T001',
		],
		[
			'R6 fallback rescues the last grade with its raw code',
			of('NRC5|A5')?.gradeTypeCode === 'ZZ1' && of('NRC5|A5')?.grade === '15.00',
		],
		[
			'R6 the rescued raw code is flagged as unregistered',
			has('NRC5|A5', GRADE_RC_OBSERVATIONS.FALLBACK_GRADE) &&
				has('NRC5|A5', GRADE_RC_OBSERVATIONS.UNREGISTERED_GRADE_TYPE),
		],
		[
			'R6 no fallback when the designated type is present',
			!inSection('NRC6').some((row) => row.gradeTypeCode === 'QQ2'),
		],
		[
			'R6 a student who has a designated grade keeps its own type and weight',
			of('NRC6|A6')?.gradeTypeCode === 'TG205-T002' &&
				of('NRC6|A6')?.gradeTypePercentage === '20' &&
				of('NRC6|A6B')?.gradeTypeCode === 'TG205-T001' &&
				of('NRC6|A6B')?.gradeTypePercentage === '5',
		],
		[
			'R6 missing designated -> code, name and weight from ONE designated row',
			of('NRC6|A6C')?.gradeTypeCode === 'TG205-T001' &&
				of('NRC6|A6C')?.gradeTypeName === 'EA1' &&
				of('NRC6|A6C')?.gradeTypePercentage === '5' &&
				of('NRC6|A6C')?.grade === '0',
		],
		[
			'R6 missing designated with no reason -> NR + unexplained',
			of('NRC6|A6C')?.qualificationStatusCode === QUALIFICATION_STATUSES.NR &&
				has('NRC6|A6C', GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_UNEXPLAINED),
		],
		[
			'R6 missing designated explained by a course-level status',
			of('NRC8|A8')?.gradeTypeCode === 'TG205-T001' &&
				of('NRC8|A8')?.gradeTypePercentage === '70' &&
				of('NRC8|A8')?.grade === '0' &&
				of('NRC8|A8')?.qualificationStatusCode === 'TG404-T005' &&
				has('NRC8|A8', GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE),
		],
		[
			'R6 missing designated while the evaluation is still open -> pending',
			of('NRC11|A11B')?.grade === '0' &&
				has('NRC11|A11B', GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_PENDING),
		],
		['R8 career resolved from the Banner program code', of('NRC1|A1')?.careerCode === 'SW'],
		[
			'R8 career resolved independently of which row carries the grade',
			of('NRC2|A2')?.careerCode === 'CC',
		],
		[
			'R8 program outside the career map -> empty career, row still ships',
			of('NRC5|A5')?.careerCode === '' && of('NRC5|A5')?.grade === '15.00',
		],
		['R8 student with no Banner record -> empty career', of('NRC7|A7')?.careerCode === ''],
		[
			'R5a a student the app has not matriculated for the period at all is dropped entirely',
			of('NRC1|A1E') === undefined,
		],
		[
			'R5b a matriculado missing from THIS section, course on their plan, still ships, flagged',
			has('NRC1|A1B', GRADE_RC_OBSERVATIONS.STUDENT_NOT_IN_SECTION) &&
				!has('NRC1|A1', GRADE_RC_OBSERVATIONS.STUDENT_NOT_IN_SECTION),
		],
		[
			'R5c a matriculado missing from THIS section, course NOT on their plan, is dropped entirely',
			of('NRC1|A1F') === undefined,
		],
	];
}

// The worksheet split used to be a WHERE on the durable child table (readPage); that table is gone
// (see ADR-004), so the split now happens client-side on the same in-memory array the real
// generation collects. What is checked is that the partition is disjoint and adds up to the whole
// export, the same property the old two-query version checked. Operates on the already-paginated
// rows from main() -- no DB round trip of its own.
function verifySplit(rows: MaterializedRow[]): Array<[string, boolean]> {
	const key = (row: ExportedRow) => `${row.sectionCode}|${row.studentCode}`;
	const clean = rows.filter((r) => !r.hasObservations);
	const review = rows.filter((r) => r.hasObservations);
	const cleanKeys = new Set(clean.map(key));

	return [
		[
			'R9 the upload sheet carries no observation at all',
			clean.every((r) => r.observations.length === 0),
		],
		[
			'R9 every reviewed row carries one',
			review.length > 0 && review.every((r) => r.observations.length > 0),
		],
		['R9 the halves are disjoint', !review.some((r) => cleanKeys.has(key(r)))],
		['R9 the halves add up to the whole export', clean.length + review.length === rows.length],
	];
}

type MaterializedRow = ExportedRow & { exportSeq: string; hasObservations: boolean };

async function readAllPages(db: Client): Promise<MaterializedRow[]> {
	const all: MaterializedRow[] = [];
	let lastSeq = '0';
	for (;;) {
		const { rows: pageRows } = await db.query<MaterializedRow>(READ_GRADES_RC_ALL_PAGE_SQL, [
			lastSeq,
			2,
		]);
		if (pageRows.length === 0) break;
		all.push(...pageRows);
		lastSeq = pageRows[pageRows.length - 1].exportSeq;
	}
	return all;
}

// Mirrors GradesRcExportRepository.resolveInStudyPlanRescues, but answers the membership check from
// the fixture's own IN_STUDY_PLAN pairs instead of a real STUDY_PLAN_MEMBERSHIP_FOR_PAIRS_SQL call:
// that query reads academic.* on the MAIN datasource, which this throwaway (raw-only) database never
// sets up. GRADES_RC_SQL's notInSection candidates and PRUNE_GRADES_RC_UNRESOLVED_SQL's prune both
// still run for real -- only the membership answer itself is a fixture-driven stand-in.
async function resolveInStudyPlanRescues(db: Client): Promise<void> {
	const { rows: candidates } = await db.query<{ sectionCode: string; studentCode: string }>(
		NOT_IN_SECTION_CANDIDATES_SQL,
	);
	const inStudyPlan = new Set(IN_STUDY_PLAN.map(([section, student]) => `${section}|${student}`));
	const matched = candidates.filter((c) => inStudyPlan.has(`${c.sectionCode}|${c.studentCode}`));

	await db.query(PRUNE_GRADES_RC_UNRESOLVED_SQL, [
		matched.map((m) => m.sectionCode),
		matched.map((m) => m.studentCode),
	]);
	await db.query(DROP_NOT_IN_SECTION_COLUMN_SQL);
}

async function main(): Promise<void> {
	const db = new Client({ connectionString: resolveConnectionString() });
	await db.connect();
	try {
		await assertThrowaway(db);
		await loadFixtures(db);
		const params = [
			'202610',
			Object.keys(GRADE_TYPES),
			Object.values(GRADE_TYPES),
			Object.keys(QUALIFICATION_STATUSES),
			Object.values(QUALIFICATION_STATUSES),
			DESIGNATED.map(([section]) => section),
			DESIGNATED.map(([, code]) => code),
			QUALIFICATION_STATUSES.ASISTIO,
			QUALIFICATION_STATUSES.SAN,
			SCOPED_SECTIONS,
			QUALIFICATION_STATUSES.RET,
			ENROLLED.map(([section]) => section),
			ENROLLED.map(([, student]) => student),
			Object.keys(PROGRAM_CAREER_MAP),
			Object.values(PROGRAM_CAREER_MAP),
			QUALIFICATION_STATUSES.NR,
			PERIOD_ENROLLED,
		];

		await db.query(`DROP TABLE IF EXISTS ${GRADES_RC_TEMP_TABLE}`);
		await db.query(MATERIALIZE_GRADES_RC_SQL, params);
		await resolveInStudyPlanRescues(db);
		await db.query(INDEX_GRADES_RC_TEMP_SQL);
		await db.query(`ANALYZE ${GRADES_RC_TEMP_TABLE}`);

		const rows = await readAllPages(db);

		console.table(
			rows.map((row) => ({ ...row, observations: (row.observations ?? []).join(',') })),
		);
		const results = [...assertions(rows), ...verifySplit(rows)];
		for (const [label, ok] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);

		const failed = results.filter(([, ok]) => !ok).length;
		if (failed > 0) throw new Error(`${failed} of ${results.length} checks failed`);
		console.log(`\n${results.length} checks passed.`);
	} finally {
		await db.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
