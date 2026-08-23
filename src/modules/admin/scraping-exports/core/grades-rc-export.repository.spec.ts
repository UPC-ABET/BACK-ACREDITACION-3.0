import { Logger } from '@nestjs/common';
import { GradesRcExportRepository } from './grades-rc-export.repository';
import { MATERIALIZE_GRADES_RC_SQL, READ_GRADES_RC_ALL_PAGE_SQL } from './grades-rc-export.sql';
import { PROGRAM_CAREER_MAP } from '../model/scraping-exports.transforms';

// The merge itself (Banner + Planner cross, newest scrape wins, last-grade fallback) is SQL, so it
// is NOT exercised here -- `query` is mocked. It is verified by running
// `test/manual/grades-rc-export.verify.ts` against a real Postgres, by hand: nothing in CI does it.
// What is testable here is the contract between the two connections: everything the main DB owns
// must reach the raw query as parameters, in the order the SQL binds them.
describe('GradesRcExportRepository.openGradesRcExport', () => {
	const rawQuery = jest.fn();
	const release = jest.fn();
	// The export pins one connection: the scratch table lives in that session and the pages are read
	// back from it, so every raw statement goes through this runner rather than the pool.
	const createQueryRunner = jest.fn(() => ({
		connect: jest.fn().mockResolvedValue(undefined),
		query: rawQuery,
		release,
	}));
	const mainQuery = jest.fn();
	const repo = new GradesRcExportRepository(
		{ createQueryRunner } as any,
		{ query: mainQuery } as any,
	);

	// The statements the export issues on the raw connection, in order: drop leftovers, session tuning,
	// materialize, index, then one read per page, then drop and reset again on close.
	const materializeCall = () =>
		rawQuery.mock.calls.find(([sql]) => sql === MATERIALIZE_GRADES_RC_SQL);
	const pageCalls = (): unknown[][] =>
		rawQuery.mock.calls
			.filter(([sql]) => sql === READ_GRADES_RC_ALL_PAGE_SQL)
			.map(([, params]) => params);

	const mainQueryFake = (sql: string, params: unknown[]) => {
		if (sql.includes('FROM academic.academic_periods'))
			return Promise.resolve([{ code: '202610' }]);
		if (sql.includes('core.type_groups')) {
			return params[0] === 'TG205'
				? Promise.resolve([
						{ name: 'EA1', code: 'TG205-T001' },
						{ name: 'EB1', code: 'TG205-T002' },
					])
				: Promise.resolve([{ name: 'RET', code: 'TG404-T005' }]);
		}
		// All four section queries read course_sections and two of them join study_plan_courses, so
		// each is matched on the narrowest table it owns, most specific first: the control-outcome
		// query is the only one touching course_outcome_mappings, so it has to precede the designated
		// one below.
		if (sql.includes('course_outcome_mappings')) {
			return Promise.resolve([{ sectionCode: 'NRC1' }]);
		}
		if (sql.includes('study_plan_courses')) {
			return Promise.resolve([
				{ sectionCode: 'NRC1', gradeTypeCode: 'TG205-T001' },
				{ sectionCode: 'NRC2', gradeTypeCode: 'TG205-T002' },
			]);
		}
		if (sql.includes('student_section_enrollments')) {
			return Promise.resolve([{ sectionCodes: ['NRC1', 'NRC2'], studentCodes: ['A1', 'A2'] }]);
		}
		if (sql.includes('course_sections')) {
			return Promise.resolve([{ sectionCode: 'NRC1' }, { sectionCode: 'NRC2' }]);
		}
		throw new Error(`unexpected main query: ${sql}`);
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mainQuery.mockImplementation(mainQueryFake);
		rawQuery.mockResolvedValue([]);
	});

	it('sets work_mem, jit and enable_nestloop on the connection before materializing', async () => {
		await repo.openGradesRcExport(1);

		const materializeIndex = rawQuery.mock.calls.findIndex(
			([sql]) => sql === MATERIALIZE_GRADES_RC_SQL,
		);
		const settingSqls = rawQuery.mock.calls.slice(0, materializeIndex).map(([sql]) => sql);
		expect(settingSqls).toEqual(
			expect.arrayContaining([
				`SET work_mem = '128MB'`,
				`SET jit = off`,
				`SET enable_nestloop = off`,
			]),
		);
	});

	it('ships the period code, both catalogs and the designated types as parallel arrays', async () => {
		await repo.openGradesRcExport(1);

		const [sql, params] = materializeCall();
		expect(sql).toBe(MATERIALIZE_GRADES_RC_SQL);
		expect(params[0]).toBe('202610');
		expect(params[1]).toEqual(['EA1', 'EB1']);
		expect(params[2]).toEqual(['TG205-T001', 'TG205-T002']);
		expect(params[3]).toEqual(['RET']);
		expect(params[4]).toEqual(['TG404-T005']);
		expect(params[5]).toEqual(['NRC1', 'NRC2']);
		expect(params[6]).toEqual(['TG205-T001', 'TG205-T002']);
		expect(params[7]).toBe('TG404-T001');
		expect(params[8]).toBe('TG404-T006');
		// Already intersected with the control-outcome sections -- see the dedicated test below.
		expect(params[9]).toEqual(['NRC1']);
		expect(params[10]).toBe('TG404-T005');
		expect(params[11]).toEqual(['NRC1', 'NRC2']);
		expect(params[12]).toEqual(['A1', 'A2']);
		// The career map is a constant, not a query: assert the shape, not every program.
		expect(params[13]).toEqual(Object.keys(PROGRAM_CAREER_MAP));
		expect(params[14]).toEqual(Object.values(PROGRAM_CAREER_MAP));
		expect(params[15]).toBe('TG404-T002');
		expect(params).toHaveLength(16);
	});

	// One scope array, not two ANDed in SQL: the planner reads two arrays over section_code as
	// independent and underestimates the scope badly enough to stop the merge finishing at all.
	// NRC2 is loaded but carries no control outcome, so it must not survive the intersection.
	it('scopes the export to the loaded sections that carry a control outcome', async () => {
		await repo.openGradesRcExport(1);

		const [, params] = materializeCall();
		expect(params[9]).toEqual(['NRC1']);
		expect(mainQuery.mock.calls.some(([sql]) => sql.includes('course_outcome_mappings'))).toBe(
			true,
		);
	});

	// The enrollment lookup only ever needs pairs the merge could actually use, so it takes the same
	// scoped set rather than every enrollment in the period.
	it('scopes the enrollment lookup to the same intersected sections', async () => {
		await repo.openGradesRcExport(1);

		const enrollmentCall = mainQuery.mock.calls.find(([sql]) =>
			sql.includes('student_section_enrollments'),
		);
		expect(enrollmentCall?.[1]).toEqual([1, ['NRC1']]);
	});

	// Pages are read until one comes back short of the page size, and the rows are handed on
	// untouched: the whole transformation is in SQL. Tagged with hasObservations; the two-sheet
	// split happens in memory once collected (see ScrapingExportsService.renderGradesRc, ADR-004).
	it('walks the scratch table a page at a time and yields the rows untouched', async () => {
		const row = (seq: string, studentCode: string) => ({
			exportSeq: seq,
			sectionCode: 'NRC1',
			studentCode,
			gradeTypeCode: 'TF1',
			gradeTypePercentage: '40',
			grade: '18.00',
			qualificationStatusCode: 'TG404-T001',
			hasObservations: false,
		});

		const handle = await repo.openGradesRcExport(1);
		rawQuery.mockResolvedValueOnce([row('1', 'A1'), row('2', 'A2')]).mockResolvedValueOnce([]);

		const collected: unknown[] = [];
		for await (const r of handle.rows()) collected.push(r);

		expect(collected).toEqual([row('1', 'A1'), row('2', 'A2')]);
		// Second page asked for everything after the last row of the first: keyset, not offset.
		const [, pageParams] = rawQuery.mock.calls[rawQuery.mock.calls.length - 1];
		expect(pageParams[0]).toBe('2');
	});

	it('reads pages with only the cursor and page-size parameters, not a hasObservations filter', async () => {
		const handle = await repo.openGradesRcExport(1);

		for await (const _ of handle.rows());

		expect(pageCalls().every((params) => params.length === 2)).toBe(true);
	});

	// The cursor has to restart on every fresh call to `rows()`: a leaked cursor from a prior call
	// would silently skip rows or terminate early on the next materialize+read cycle.
	it('restarts the keyset cursor on every call to rows()', async () => {
		const handle = await repo.openGradesRcExport(1);
		rawQuery
			.mockResolvedValueOnce([
				{ exportSeq: '7', sectionCode: 'NRC1', studentCode: 'A1', hasObservations: false },
			])
			.mockResolvedValueOnce([]);

		for await (const _ of handle.rows());
		expect(pageCalls().map((params) => params[0])).toEqual(['0', '7']);

		rawQuery.mockResolvedValueOnce([]);
		for await (const _ of handle.rows());
		expect(pageCalls().map((params) => params[0])).toEqual(['0', '7', '0']);
	});

	// The handle owns a pooled connection; leaking one leaks it for the life of the process.
	it('drops the scratch table, resets the session tuning and releases the connection on close', async () => {
		const handle = await repo.openGradesRcExport(1);
		rawQuery.mockClear();
		await handle.close();

		const sqls = rawQuery.mock.calls.map(([sql]) => sql);
		expect(sqls).toEqual([
			'DROP TABLE IF EXISTS grades_rc_export_rows',
			'RESET work_mem',
			'RESET jit',
			'RESET enable_nestloop',
		]);
		expect(release).toHaveBeenCalled();
	});

	it('releases the connection when the merge itself fails', async () => {
		rawQuery.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('merge failed'));

		await expect(repo.openGradesRcExport(1)).rejects.toThrow('merge failed');
		expect(release).toHaveBeenCalled();
	});

	// A failed RESET must not suppress the others: enable_nestloop=off leaking on the pooled
	// connection would silently degrade unrelated queries reusing it after release.
	it('still attempts every RESET, logs the failure, and still releases the connection when one RESET rejects', async () => {
		const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const handle = await repo.openGradesRcExport(1);
		rawQuery.mockClear();
		rawQuery.mockImplementation((sql: string) =>
			sql === 'RESET work_mem' ? Promise.reject(new Error('reset failed')) : Promise.resolve([]),
		);

		await handle.close();

		const sqls = rawQuery.mock.calls.map(([sql]) => sql);
		expect(sqls).toEqual([
			'DROP TABLE IF EXISTS grades_rc_export_rows',
			'RESET work_mem',
			'RESET jit',
			'RESET enable_nestloop',
		]);
		expect(release).toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('work_mem'));
		warnSpy.mockRestore();
	});

	// The loaded sections are what keeps a grade out of the upload sheet, so they have to reach the
	// raw query even when the period has none — an empty array means "nothing is loaded", not
	// "skip the check".
	it('ships an empty loaded-sections array when the period has no sections yet', async () => {
		mainQuery.mockImplementation((sql: string, params: unknown[]) =>
			sql.includes('study_plan_courses') || sql.includes('course_sections')
				? Promise.resolve([])
				: mainQueryFake(sql, params),
		);

		await repo.openGradesRcExport(1);

		const [, params] = materializeCall();
		expect(params[9]).toEqual([]);
	});

	// Only the newest run is read, so a run that is unusable ('running', 'failed') or narrower than
	// its predecessor ('partial': scoped to one school, or died halfway) must not win on started_at
	// -- it would silently ship a half-scraped period.
	it('reads only complete runs, on both sources', () => {
		const runCtes = MATERIALIZE_GRADES_RC_SQL.split('banner_grades AS')[0];
		expect(runCtes).toContain('FROM scrape_run');
		expect(runCtes).toContain('FROM planner_scrape_run');
		expect(runCtes.match(/status IN \('completed'\)/g)).toHaveLength(2);
	});
});

describe('GradesRcExportRepository.getDesignatedGradeTypesBySection', () => {
	const mainQuery = jest.fn();
	const repo = new GradesRcExportRepository(
		{ query: jest.fn() } as any,
		{ query: mainQuery } as any,
	);

	beforeEach(() => jest.clearAllMocks());

	it('keeps every designated type of a section: a course can live in several study plans', async () => {
		const designated = [
			{ sectionCode: 'NRC1', gradeTypeCode: 'TG205-T001' },
			{ sectionCode: 'NRC1', gradeTypeCode: 'TG205-T002' },
		];
		mainQuery.mockResolvedValueOnce(designated);

		await expect(repo.getDesignatedGradeTypesBySection(7)).resolves.toEqual(designated);
		expect(mainQuery.mock.calls[0][1]).toEqual([7]);
	});
});
