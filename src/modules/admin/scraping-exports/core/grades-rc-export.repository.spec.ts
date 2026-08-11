import { GradesRcExportRepository } from './grades-rc-export.repository';
import { MATERIALIZE_GRADES_RC_SQL } from './grades-rc-export.sql';
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

	// The statements the export issues on the raw connection, in order: drop leftovers, materialize,
	// index, then one read per page, then drop again on close.
	const materializeCall = () => rawQuery.mock.calls[1];

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
		// All three section queries read course_sections; the designated one joins the study plans and
		// the enrollment one joins student_section_enrollments, so those are matched first.
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
		expect(params[9]).toEqual(['NRC1', 'NRC2']);
		expect(params[10]).toBe('TG404-T005');
		expect(params[11]).toEqual(['NRC1', 'NRC2']);
		expect(params[12]).toEqual(['A1', 'A2']);
		// The career map is a constant, not a query: assert the shape, not every program.
		expect(params[13]).toEqual(Object.keys(PROGRAM_CAREER_MAP));
		expect(params[14]).toEqual(Object.values(PROGRAM_CAREER_MAP));
	});

	// Pages are read until one comes back short of the page size, and the rows are handed on
	// untouched: the whole transformation is in SQL.
	it('walks the scratch table a page at a time and yields the rows untouched', async () => {
		const row = (seq: string, studentCode: string) => ({
			export_seq: seq,
			sectionCode: 'NRC1',
			studentCode,
			gradeTypeCode: 'TF1',
			gradeTypePercentage: '40',
			grade: '18.00',
			qualificationStatusCode: 'TG404-T001',
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

	// The scratch table can be walked twice, which is what lets both worksheets come out of one run
	// of the merge instead of two.
	it('can be walked more than once', async () => {
		const handle = await repo.openGradesRcExport(1);
		const callsAfterOpen = rawQuery.mock.calls.length;

		for await (const _ of handle.rows());
		for await (const _ of handle.rows());

		expect(rawQuery.mock.calls.length).toBeGreaterThan(callsAfterOpen + 1);
	});

	// The handle owns a pooled connection; leaking one leaks it for the life of the process.
	it('drops the scratch table and releases the connection on close', async () => {
		const handle = await repo.openGradesRcExport(1);
		await handle.close();

		const [lastSql] = rawQuery.mock.calls[rawQuery.mock.calls.length - 1];
		expect(lastSql).toContain('DROP TABLE IF EXISTS');
		expect(release).toHaveBeenCalled();
	});

	it('releases the connection when the merge itself fails', async () => {
		rawQuery.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('merge failed'));

		await expect(repo.openGradesRcExport(1)).rejects.toThrow('merge failed');
		expect(release).toHaveBeenCalled();
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
