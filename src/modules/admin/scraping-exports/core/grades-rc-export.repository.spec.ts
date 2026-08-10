import { GradesRcExportRepository } from './grades-rc-export.repository';
import { GRADES_RC_SQL } from './grades-rc-export.sql';

// The merge itself (Banner + Planner cross, newest scrape wins, last-grade fallback) is SQL and is
// exercised against a real Postgres in the change runbook. What is testable here is the contract
// between the two connections: everything the main DB owns must reach the raw query as parameters.
describe('GradesRcExportRepository.getGradesRcRows', () => {
	const rawQuery = jest.fn();
	const mainQuery = jest.fn();
	const repo = new GradesRcExportRepository(
		{ query: rawQuery } as any,
		{ query: mainQuery } as any,
	);

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
		// Both section queries read course_sections; only the designated one joins the study plans.
		if (sql.includes('study_plan_courses')) {
			return Promise.resolve([
				{ sectionCode: 'NRC1', gradeTypeCode: 'TG205-T001' },
				{ sectionCode: 'NRC2', gradeTypeCode: 'TG205-T002' },
			]);
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
		await repo.getGradesRcRows(1);

		const [sql, params] = rawQuery.mock.calls[0];
		expect(sql).toBe(GRADES_RC_SQL);
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
	});

	it('returns the raw rows untouched: the whole transformation is in SQL', async () => {
		const row = {
			sectionCode: 'NRC1',
			studentCode: 'A1',
			gradeTypeCode: 'TF1',
			gradeTypePercentage: '40',
			grade: '18.00',
			qualificationStatusCode: 'TG404-T001',
		};
		rawQuery.mockResolvedValueOnce([row]);

		await expect(repo.getGradesRcRows(1)).resolves.toEqual([row]);
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

		await repo.getGradesRcRows(1);

		const [, params] = rawQuery.mock.calls[0];
		expect(params[9]).toEqual([]);
	});

	// Only the newest run is read, so a run that is unusable ('running', 'failed') or narrower than
	// its predecessor ('partial': scoped to one school, or died halfway) must not win on started_at
	// -- it would silently ship a half-scraped period.
	it('reads only complete runs, on both sources', () => {
		const runCtes = GRADES_RC_SQL.split('banner_grades AS')[0];
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
