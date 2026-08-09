/**
 * Behavioural verification of GRADES_RC_SQL (the Banner + Planner merge behind
 * GET /scraping/exports/grades-rc). The merge, the "newest scrape wins" rule and the last-grade
 * fallback are SQL, so they can only be proven against a real Postgres — the jest suite mocks
 * `query` and never executes them.
 *
 * It loads fixtures into a THROWAWAY database and TRUNCATEs both run tables first, so it refuses
 * to run against anything but an explicit VERIFY_DB_URL that is not the configured RAW_DB_URL.
 *
 *   docker run -d --rm --name abet-rc-verify -e POSTGRES_PASSWORD=postgres \
 *     -e POSTGRES_DB=rawverify -p 55433:5432 postgres:16
 *   RAW_DB_URL=postgres://postgres:postgres@localhost:55433/rawverify pnpm migration:raw:run
 *   VERIFY_DB_URL=postgres://postgres:postgres@localhost:55433/rawverify \
 *     npx ts-node -T -r tsconfig-paths/register test/manual/grades-rc-export.verify.ts
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';

import { GRADES_RC_SQL } from 'src/modules/admin/scraping-exports/core/grades-rc-export.sql';

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
const DESIGNATED: Array<[string, string]> = [
	['NRC1', 'TG205-T001'],
	['NRC2', 'TG205-T002'],
	['NRC3', 'TG205-T001'],
	['NRC4', 'TG205-T002'],
	// NRC5 and NRC7 are deliberately absent: an unconfigured section arms the fallback.
	['NRC6', 'TG205-T001'],
	['NRC6', 'TG205-T002'],
];

interface ExportedRow {
	sectionCode: string;
	studentCode: string;
	gradeTypeCode: string;
	gradeTypePercentage: string;
	grade: string;
	qualificationStatusCode: string;
}

function resolveConnectionString(): string {
	const url = process.env.VERIFY_DB_URL;
	if (!url) throw new Error('VERIFY_DB_URL is required: point it at a throwaway database.');
	if (process.env.RAW_DB_URL && process.env.RAW_DB_URL === url) {
		throw new Error('VERIFY_DB_URL must not be the real RAW_DB_URL: this script truncates.');
	}
	return url;
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

	for (const [nrc, student] of [
		['NRC1', 'A1'],
		['NRC2', 'A2'],
		['NRC3', 'A3'],
		['NRC4', 'A4'],
		['NRC5', 'A5'],
		['NRC6', 'A6'],
		['NRC7', 'A7'],
	]) {
		await horario(nrc, nrc.slice(3));
		await matricula(nrc, student);
	}

	await notas('A1', '1ASI1', [
		{ tipo: 'EA1', peso: 20, nota: '14.80', numero: 1 }, // Banner only
		{ tipo: 'PC1', peso: 15, nota: '10.00', numero: 2 }, // also in Planner, scraped later
		{ tipo: 'EB1', peso: 20, nota: '16.00', numero: 3 }, // also in Planner, same value
		{ tipo: 'PA', peso: 10, nota: 'RET', numero: 4 }, // non-numeric, known TG404 status
		{ tipo: 'TA', peso: 10, nota: 'XXX', numero: 5 }, // non-numeric, unknown status
	]);
	await notas('A2', '1ASI2', [
		{ tipo: 'TA', peso: 40, nota: '12.00', numero: 1 },
		{ tipo: 'PC3', peso: 60, nota: '18.00', numero: 5 }, // unknown type, last -> rescued
	]);
	await notas('A3', '1ASI3', [
		{ tipo: 'EA1', peso: 50, nota: '11.00', numero: 1 }, // designated type present
		{ tipo: 'ZZ9', peso: 50, nota: '19.00', numero: 9 }, // unknown type -> dropped
	]);
	await notas('A4', '1ASI4', [{ tipo: 'EA1', peso: 100, nota: '13.00', numero: 7 }]);
	await notas('A5', '1ASI5', [{ tipo: 'ZZ1', peso: 100, nota: '15.00', numero: 3 }]);
	await notas('A6', '1ASI6', [
		{ tipo: 'EB1', peso: 60, nota: '14.00', numero: 2 },
		{ tipo: 'QQ2', peso: 40, nota: '16.00', numero: 8 },
	]);
	await notas('A1', '1ASI1', [{ tipo: 'EA1', peso: 20, nota: '99.00', numero: 1 }], {
		scrapedAt: NEWER_SCRAPE,
		runId: BANNER_UNFINISHED_RUN,
	});

	await seccion('900001', 'NRC1');
	await evaluacion('900001', '338001', {
		evalComponentCode: 'PC1',
		evalComponentName: 'Práctica Calificada 1',
		percentage: 15,
		isFinal: 0,
		isFinalEvaluation: 0,
		orderEvaluation: 2,
		componentTypeId: 1,
	});
	await evaluacion('900001', '338002', {
		evalComponentCode: 'EB1',
		evalComponentName: 'Evaluación Final 1',
		percentage: 20,
		isFinal: 0,
		isFinalEvaluation: 1,
		orderEvaluation: 3,
		componentTypeId: 1,
	});
	await evaluacion('900001', '338003', {
		evalComponentCode: 'TB1',
		evalComponentName: 'Trabajo 1',
		percentage: 25,
		isFinal: 0,
		isFinalEvaluation: 0,
		orderEvaluation: 4,
		componentTypeId: 1,
	});
	await evaluacion('900001', '338004', {
		evalComponentCode: 'NF',
		evalComponentName: 'Nota Final',
		formula: '0.2 * TB1',
		percentage: 100,
		isFinal: 1,
		isFinalEvaluation: 0,
		orderEvaluation: 1,
		componentTypeId: 2,
	});
	await notaPlanner(
		'900001',
		'338001',
		'A1',
		{ grade: 12, gradeFormat: '12.00', isFinal: 0, isSanctioned: 0 },
		NEWER_SCRAPE,
	);
	await notaPlanner(
		'900001',
		'338002',
		'A1',
		{ grade: 16, gradeFormat: '16.00', isFinal: 0, isSanctioned: 0 },
		NEWER_SCRAPE,
	);
	await notaPlanner(
		'900001',
		'338003',
		'A1',
		{ grade: 17, gradeFormat: '17.00', isFinal: 0, isSanctioned: 0 },
		NEWER_SCRAPE,
	);
	await notaPlanner(
		'900001',
		'338004',
		'A1',
		{ grade: 15, gradeFormat: '15.00', isFinal: 1, isSanctioned: 0 },
		NEWER_SCRAPE,
	);

	await seccion('900002', 'NRC7');
	await evaluacion('900002', '338101', {
		evalComponentCode: 'TB1',
		evalComponentName: 'Trabajo 2',
		percentage: 30,
		isFinal: 0,
		isFinalEvaluation: 0,
		orderEvaluation: 1,
		componentTypeId: 1,
	});
	await evaluacion('900002', '338102', {
		evalComponentCode: 'PC1',
		evalComponentName: 'Práctica Calificada 1',
		percentage: 20,
		isFinal: 0,
		isFinalEvaluation: 0,
		orderEvaluation: 2,
		componentTypeId: 1,
	});
	await evaluacion('900002', '338103', {
		evalComponentCode: 'EA1',
		evalComponentName: 'Evaluación Parcial 1',
		percentage: 50,
		isFinal: 0,
		isFinalEvaluation: 0,
		orderEvaluation: 3,
		componentTypeId: 1,
	});
	await notaPlanner('900002', '338101', 'A7', {
		grade: null,
		gradeFormat: null,
		isFinal: 0,
		isSanctioned: 1,
	});
	await notaPlanner('900002', '338102', 'A7', {
		grade: null,
		gradeFormat: null,
		isFinal: 0,
		isSanctioned: 0,
	});
	// component_id that resolves through no evaluation: matched by evaluation name instead.
	await notaPlanner('900002', '999999', 'A7', {
		evaluation: 'Evaluación Parcial 1',
		grade: 18,
		gradeFormat: '18.00',
		isFinal: 0,
		isSanctioned: 0,
	});
}

function assertions(rows: ExportedRow[]): Array<[string, boolean]> {
	const key = (row: ExportedRow) => `${row.sectionCode}|${row.studentCode}|${row.gradeTypeCode}`;
	const byKey = new Map(rows.map((row) => [key(row), row]));
	const of = (k: string) => byKey.get(k);
	const inSection = (section: string) => rows.filter((row) => row.sectionCode === section);

	return [
		['no duplicated (section, student, grade type)', new Set(rows.map(key)).size === rows.length],
		['R4 grade only Banner has', of('NRC1|A1|TG205-T001')?.grade === '14.80'],
		['R4 grade only Planner has', of('NRC1|A1|TG205-T005')?.grade === '17.00'],
		[
			'R4 both sources agree -> one row',
			rows.filter((r) => key(r) === 'NRC1|A1|TG205-T002').length === 1,
		],
		['R4 sources disagree -> newest scrape wins', of('NRC1|A1|TG205-T008')?.grade === '12.00'],
		[
			'R4 the winning row brings its own weight',
			of('NRC1|A1|TG205-T008')?.gradeTypePercentage === '15',
		],
		['R1 unfinished run ignored', of('NRC1|A1|TG205-T001')?.grade !== '99.00'],
		[
			'R7 numeric grade -> ASISTIO',
			of('NRC1|A1|TG205-T001')?.qualificationStatusCode === 'TG404-T001',
		],
		[
			'R7 non-numeric grade -> 0 + known TG404 code',
			of('NRC1|A1|TG205-T003')?.grade === '0' &&
				of('NRC1|A1|TG205-T003')?.qualificationStatusCode === 'TG404-T005',
		],
		[
			'R7 unknown status text passed through',
			of('NRC1|A1|TG205-T004')?.qualificationStatusCode === 'XXX',
		],
		[
			'R7 sanctioned Planner grade -> 0 + SAN',
			of('NRC7|A7|TG205-T005')?.grade === '0' &&
				of('NRC7|A7|TG205-T005')?.qualificationStatusCode === 'TG404-T006',
		],
		['R3 computed final grade excluded', !rows.some((row) => row.gradeTypeCode === 'NF')],
		[
			'R3 ungraded evaluation excluded',
			!inSection('NRC7').some((r) => r.gradeTypeCode === 'TG205-T008'),
		],
		[
			'R3 evaluation matched by name when the id misses',
			of('NRC7|A7|TG205-T001')?.grade === '18.00',
		],
		['R6 fallback rescues the last grade with its raw code', of('NRC2|A2|PC3')?.grade === '18.00'],
		['R6 fallback keeps the known-type grades too', byKey.has('NRC2|A2|TG205-T004')],
		[
			'R6 no fallback when the designated type is present',
			!inSection('NRC3').some((r) => r.gradeTypeCode === 'ZZ9'),
		],
		['R6 no duplicate when the last grade is a known type', inSection('NRC4').length === 1],
		['R6 unconfigured section -> fallback fires', of('NRC5|A5|ZZ1')?.grade === '15.00'],
		[
			'R6 designated by any of two study plans -> no fallback',
			!inSection('NRC6').some((r) => r.gradeTypeCode === 'QQ2'),
		],
	];
}

async function main(): Promise<void> {
	const db = new Client({ connectionString: resolveConnectionString() });
	await db.connect();
	try {
		await loadFixtures(db);
		const { rows } = await db.query<ExportedRow>(GRADES_RC_SQL, [
			'202610',
			Object.keys(GRADE_TYPES),
			Object.values(GRADE_TYPES),
			Object.keys(QUALIFICATION_STATUSES),
			Object.values(QUALIFICATION_STATUSES),
			DESIGNATED.map(([section]) => section),
			DESIGNATED.map(([, code]) => code),
			QUALIFICATION_STATUSES.ASISTIO,
			QUALIFICATION_STATUSES.SAN,
		]);

		console.table(rows);
		const results = assertions(rows);
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
