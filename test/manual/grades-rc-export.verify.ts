/**
 * Behavioural verification of GRADES_RC_SQL (the Banner + Planner merge behind
 * GET /scraping/exports/grades-rc). The merge, the "newest scrape wins" rule, the dedup, the
 * designated/fallback pick and the status classification are SQL, so they can only be proven
 * against a real Postgres — the jest suite mocks `query` and never executes them.
 *
 * It TRUNCATEs both run tables before loading its fixtures, and the raw_* tables cascade off them,
 * so pointing it at the real scraping database costs a full re-scrape of Banner and Planner —
 * hours, credentials, and data that exists nowhere else. Three guards stand in the way, in
 * increasing order of how much they actually prove:
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
	GRADES_RC_SQL,
	GRADES_RC_TEMP_TABLE,
	INDEX_GRADES_RC_TEMP_SQL,
	MATERIALIZE_GRADES_RC_SQL,
	READ_GRADES_RC_PAGE_SQL,
} from 'src/modules/admin/scraping-exports/core/grades-rc-export.sql';
import { GRADE_RC_OBSERVATIONS } from 'src/modules/admin/scraping-exports/model/scraping-exports.types';
import { PROGRAM_CAREER_MAP } from 'src/modules/admin/scraping-exports/model/scraping-exports.transforms';

dotenv.config();

const BANNER_RUN = '11111111-1111-1111-1111-111111111111';
const BANNER_UNFINISHED_RUN = '22222222-2222-2222-2222-222222222222';
const PLANNER_RUN = '33333333-3333-3333-3333-333333333333';

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

// academic.student_section_enrollments for the period. (NRC1, A1B) is deliberately missing: the
// upload rejects the whole file over it, so the row has to ship carrying that warning.
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
	const { rows: schema } = await db.query<{ present: boolean }>(
		`SELECT (to_regclass('public.raw_notas') IS NOT NULL
		     AND to_regclass('public.raw_planner_nota') IS NOT NULL) AS present`,
	);
	if (!schema[0]?.present) {
		throw new Error(
			'The raw tables are missing: run `pnpm migration:raw:run` against VERIFY_DB_URL first.',
		);
	}

	const { rows: counted } = await db.query<{ total: string }>(
		`SELECT (SELECT count(*) FROM raw_notas)
		      + (SELECT count(*) FROM raw_planner_nota) AS total`,
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
		`INSERT INTO scrape_run (id, periodo, nivel, departamentos, status, started_at) VALUES
			($1, '202610', 'UG', '{ISW}', 'completed', $3),
			($2, '202610', 'UG', '{ISW}', 'running',   $4)`,
		[BANNER_RUN, BANNER_UNFINISHED_RUN, OLDER_SCRAPE, NEWER_SCRAPE],
	);
	await db.query(
		`INSERT INTO planner_scrape_run (id, periodo, status, started_at)
		 VALUES ($1, '202610', 'completed', $2)`,
		[PLANNER_RUN, OLDER_SCRAPE],
	);

	const horario = (nrc: string, courseNumber: string) =>
		db.query(
			`INSERT INTO raw_horario (run_id, nivel, periodo, departamento, nrc, payload, payload_hash)
			 VALUES ($1, 'UG', '202610', 'ISW', $2, $3::jsonb, repeat('0', 64))`,
			[BANNER_RUN, nrc, JSON.stringify({ materia: { codigo: '1ASI' }, numeroCurso: courseNumber })],
		);
	const matricula = (nrc: string, studentCode: string) =>
		db.query(
			`INSERT INTO raw_matricula (run_id, nivel, periodo, nrc, codigo_alumno, payload, payload_hash)
			 VALUES ($1, 'UG', '202610', $2, $3, '{}'::jsonb, repeat('0', 64))`,
			[BANNER_RUN, nrc, studentCode],
		);
	// raw_alumno is where the student's name and Banner program live. Only Banner has it, so a
	// student who exists solely in Planner has neither -- which is a case the assertions cover.
	const alumno = (studentCode: string, programCode: string | null) =>
		db.query(
			`INSERT INTO raw_alumno (run_id, nivel, codigo_alumno, payload, payload_hash)
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
	const notas = (
		studentCode: string,
		courseCode: string,
		items: Array<Record<string, unknown>>,
		options: { scrapedAt?: string; runId?: string } = {},
	) =>
		db.query(
			`INSERT INTO raw_notas
				(run_id, nivel, periodo, codigo_alumno, curso_codigo, payload, payload_hash, scraped_at)
			 VALUES ($1, 'UG', '202610', $2, $3, $4::jsonb, repeat('0', 64), $5)`,
			[
				options.runId ?? BANNER_RUN,
				studentCode,
				courseCode,
				JSON.stringify({ detalle: { notas: items, notaFinal: '15' } }),
				options.scrapedAt ?? OLDER_SCRAPE,
			],
		);

	const seccion = (sectionId: string, nrc: string) =>
		db.query(
			`INSERT INTO raw_planner_seccion (run_id, periodo, section_id, payload, payload_hash)
			 VALUES ($1, '202610', $2, $3::jsonb, repeat('0', 64))`,
			[
				PLANNER_RUN,
				sectionId,
				JSON.stringify({ sectionId: Number(sectionId), sectionNumber: nrc }),
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
		scrapedAt = OLDER_SCRAPE,
	) =>
		db.query(
			`INSERT INTO raw_planner_nota
				(run_id, section_id, component_id, student_code, payload, payload_hash, scraped_at)
			 VALUES ($1, $2, $3, $4, $5::jsonb, repeat('0', 64), $6)`,
			[PLANNER_RUN, sectionId, componentId, studentCode, JSON.stringify(payload), scrapedAt],
		);

	// nrc -> course number. NRC1B carries NRC1's course on purpose: the same student is enrolled in
	// both loaded sections of one course, which is what the dedup has to collapse.
	const banner: Array<[string, string, string]> = [
		['NRC1', '1', 'A1'],
		['NRC1', '1', 'A1B'],
		['NRC1', '1', 'A1C'],
		['NRC1', '1', 'A1D'],
		['NRC1B', '1', 'A1'],
		['NRC2', '2', 'A2'],
		['NRC3', '3', 'A3'],
		['NRC5', '5', 'A5'],
		['NRC6', '6', 'A6'],
		['NRC6', '6', 'A6B'],
		['NRC6', '6', 'A6C'],
		['NRC8', '8', 'A8'],
		['NRC8', '8', 'A8B'],
		['NRC9', '9', 'A9'],
		['NRC12', '12', 'A12'],
		['NRC13', '13', 'A13'],
		['NRC14', '14', 'A14'],
	];
	const seenSections = new Set<string>();
	for (const [nrc, courseNumber, student] of banner) {
		if (!seenSections.has(nrc)) {
			await horario(nrc, courseNumber);
			seenSections.add(nrc);
		}
		await matricula(nrc, student);
	}

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

	// NRC1 (designated EA1): the designated grade exists only in Banner, and the student carries
	// three other evaluations that must NOT produce rows of their own.
	await notas('A1', '1ASI1', [
		{ tipo: 'EA1', peso: 20, nota: '14.80', numero: 1 },
		{ tipo: 'PA', peso: 10, nota: 'RET', numero: 4 },
		{ tipo: 'TA', peso: 10, nota: 'XXX', numero: 5 },
	]);
	await notas('A1B', '1ASI1', [{ tipo: 'EA1', peso: 20, nota: '11.00', numero: 1 }]);
	// Designated grade that is a known TG404 status instead of a number, and one whose text is not a
	// status at all.
	await notas('A1C', '1ASI1', [{ tipo: 'EA1', peso: 20, nota: 'RET', numero: 1 }]);
	await notas('A1D', '1ASI1', [{ tipo: 'EA1', peso: 20, nota: 'XXX', numero: 1 }]);
	// NRC2 (designated PC1): both sources hold it, Planner's scrape is newer and carries its own
	// weight.
	await notas('A2', '1ASI2', [{ tipo: 'PC1', peso: 60, nota: '10.00', numero: 2 }]);
	// NRC3 (designated EB1): both sources hold the same value -> one row, not two.
	await notas('A3', '1ASI3', [{ tipo: 'EB1', peso: 20, nota: '16.00', numero: 3 }]);
	// NRC5: unconfigured -> the fallback rescues the last evaluation with its raw, unregistered code.
	await notas('A5', '1ASI5', [
		{ tipo: 'TA', peso: 40, nota: '12.00', numero: 1 },
		{ tipo: 'ZZ1', peso: 60, nota: '15.00', numero: 3 },
	]);
	// NRC6 (designated EA1 AND EB1, both graded, with weights where a text max() would cross them:
	// '5' > '20'). A6C has neither and must get one consistent (code, name, weight) triple.
	await notas('A6', '1ASI6', [{ tipo: 'EB1', peso: 20, nota: '14.00', numero: 2 }]);
	await notas('A6B', '1ASI6', [{ tipo: 'EA1', peso: 5, nota: '13.00', numero: 1 }]);
	await notas('A6C', '1ASI6', [{ tipo: 'QQ2', peso: 80, nota: '17.00', numero: 8 }]);
	// NRC8 (designated EA1): A8 lacks it but is withdrawn from the course, which explains it.
	await notas('A8', '1ASI8', [
		{ tipo: 'TB1', peso: 30, nota: '12.00', numero: 2 },
		{ tipo: 'PA', peso: 10, nota: 'RET', numero: 4 },
	]);
	await notas('A8B', '1ASI8', [{ tipo: 'EA1', peso: 70, nota: '15.00', numero: 1 }]);
	// NRC12: the same designated grade Planner reports as a sanction, here as a number and scraped
	// LATER. The sanction has to win anyway -- newest-scrape-wins only applies within a tier.
	await notas('A12', '1ASI12', [{ tipo: 'TB1', peso: 25, nota: '15.00', numero: 4 }], {
		scrapedAt: NEWER_SCRAPE,
	});
	// NRC13 (designated EA1): the designated type IS present, so nothing is "missing", but its nota
	// is blank and no status explains it -- banner_legs keeps it because, unlike planner_legs, it does
	// not filter on has_grade. Nothing about this row comes from the source except the type itself.
	await notas('A13', '1ASI13', [{ tipo: 'EA1', peso: 100, nota: '', numero: 1 }]);
	// NRC14: a perfectly exportable grade whose course is mapped to no CONTROL outcome.
	await notas('A14', '1ASI14', [{ tipo: 'EA1', peso: 100, nota: '16.00', numero: 1 }]);
	// NRC9 is not in academic.course_sections: nothing of it may be exported.
	await notas('A9', '1ASI9', [{ tipo: 'EA1', peso: 100, nota: '19.00', numero: 1 }]);
	// Same student, same grade, unfinished run: must lose to the completed one.
	await notas('A1', '1ASI1', [{ tipo: 'EA1', peso: 20, nota: '99.00', numero: 1 }], {
		scrapedAt: NEWER_SCRAPE,
		runId: BANNER_UNFINISHED_RUN,
	});

	// NRC2: the disagreeing designated grade, scraped later than Banner's.
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
		NEWER_SCRAPE,
	);

	// NRC3: the same value from both sources.
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
		NEWER_SCRAPE,
	);

	// NRC4 (designated TB1): the designated grade exists ONLY in Planner. The computed "Nota Final"
	// alongside it must be dropped.
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

	// NRC12 (designated TB1): the designated grade itself is a sanction, not a number.
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
	await notaPlanner('900006', '338051', 'A12', {
		grade: null,
		gradeFormat: null,
		isFinal: 0,
		isSanctioned: 1,
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
		['R4 designated grade only Banner has', of('NRC1|A1')?.grade === '14.80'],
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
			'R7 a course-level status beats a numeric grade from the other source, however new',
			of('NRC12|A12')?.grade === '0' && of('NRC12|A12')?.source === 'Planner',
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
			'R8 career filled from the Banner leg when the Planner row wins',
			of('NRC2|A2')?.careerCode === 'CC',
		],
		[
			'R8 program outside the career map -> empty career, row still ships',
			of('NRC5|A5')?.careerCode === '' && of('NRC5|A5')?.grade === '15.00',
		],
		['R8 student with no Banner record -> empty career', of('NRC7|A7')?.careerCode === ''],
		[
			'R5 a student the app has not enrolled is flagged',
			has('NRC1|A1B', GRADE_RC_OBSERVATIONS.STUDENT_NOT_ENROLLED) &&
				!has('NRC1|A1', GRADE_RC_OBSERVATIONS.STUDENT_NOT_ENROLLED),
		],
	];
}

// The worksheet split lives in MATERIALIZE_GRADES_RC_SQL, which the export runs and this script
// otherwise never touches. Both halves are paged the way the repository does it, so what is checked
// is that they partition the export: disjoint, and together the whole thing.
async function verifySplit(
	db: Client,
	params: unknown[],
	rows: ExportedRow[],
): Promise<Array<[string, boolean]>> {
	await db.query(`DROP TABLE IF EXISTS ${GRADES_RC_TEMP_TABLE}`);
	await db.query(MATERIALIZE_GRADES_RC_SQL, params);
	await db.query(INDEX_GRADES_RC_TEMP_SQL);

	const page = async (withObservations: boolean): Promise<ExportedRow[]> => {
		const collected: ExportedRow[] = [];
		let lastSeq = '0';
		for (;;) {
			const { rows: pageRows } = await db.query<ExportedRow & { exportSeq: string }>(
				READ_GRADES_RC_PAGE_SQL,
				[lastSeq, 2, withObservations],
			);
			if (pageRows.length === 0) return collected;
			collected.push(...pageRows);
			lastSeq = pageRows[pageRows.length - 1].exportSeq;
		}
	};

	const key = (row: ExportedRow) => `${row.sectionCode}|${row.studentCode}`;
	const clean = await page(false);
	const review = await page(true);
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
		];
		const { rows } = await db.query<ExportedRow>(GRADES_RC_SQL, params);

		console.table(
			rows.map((row) => ({ ...row, observations: (row.observations ?? []).join(',') })),
		);
		const results = [...assertions(rows), ...(await verifySplit(db, params, rows))];
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
