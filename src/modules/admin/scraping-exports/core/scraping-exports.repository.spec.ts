import { ScrapingExportsRepository } from './scraping-exports.repository';

describe('ScrapingExportsRepository.findAcademicPeriodIdByCode', () => {
	const rawQuery = jest.fn();
	const mainQuery = jest.fn();
	const repo = new ScrapingExportsRepository(
		{ query: rawQuery } as any,
		{ query: mainQuery } as any,
	);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('resolves an academic period id from its code', async () => {
		mainQuery.mockResolvedValueOnce([{ id: 5 }]);

		await expect(repo.findAcademicPeriodIdByCode('202610')).resolves.toBe(5);
		expect(mainQuery).toHaveBeenCalledWith(expect.stringContaining('academic.academic_periods'), [
			'202610',
		]);
	});

	it('returns null when no period matches the code', async () => {
		mainQuery.mockResolvedValueOnce([]);

		await expect(repo.findAcademicPeriodIdByCode('unknown')).resolves.toBeNull();
	});
});

describe('ScrapingExportsRepository RUN_FOR_PERIOD status filter', () => {
	const rawQuery = jest.fn();
	const mainQuery = jest.fn();
	const repo = new ScrapingExportsRepository(
		{ query: rawQuery } as any,
		{ query: mainQuery } as any,
	);

	beforeEach(() => {
		jest.clearAllMocks();
		mainQuery.mockResolvedValueOnce([{ code: '202610' }]); // resolveAcademicPeriodCode
		rawQuery.mockResolvedValueOnce([]);
	});

	it('only selects a completed run when resolving the run to export from', async () => {
		await repo.getDocentes(1);

		const [sql] = rawQuery.mock.calls[0];
		expect(sql).toContain("status = 'completed'");
	});
});

describe('ScrapingExportsRepository.getAlumnosSecciones', () => {
	const rawQuery = jest.fn();
	const mainQuery = jest.fn();
	const repo = new ScrapingExportsRepository(
		{ query: rawQuery } as any,
		{ query: mainQuery } as any,
	);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns [] without touching the raw DB when no sections are uploaded', async () => {
		mainQuery.mockResolvedValueOnce([{ code: '202610' }]); // resolveAcademicPeriodCode
		mainQuery.mockResolvedValueOnce([]); // uploaded sections

		await expect(repo.getAlumnosSecciones(1)).resolves.toEqual([]);
		expect(rawQuery).not.toHaveBeenCalled();
	});

	it('returns [] without validating against the malla when the raw matrícula is empty', async () => {
		mainQuery.mockResolvedValueOnce([{ code: '202610' }]); // resolveAcademicPeriodCode
		mainQuery.mockResolvedValueOnce([{ sectionCode: 'NRC1' }]); // uploaded sections
		rawQuery.mockResolvedValueOnce([]); // no candidate enrollments

		await expect(repo.getAlumnosSecciones(1)).resolves.toEqual([]);
		// only the period-code + uploaded-sections queries ran; the malla validation was skipped
		expect(mainQuery).toHaveBeenCalledTimes(2);
	});

	it('ships uploaded sections into the raw query and returns the validated+collapsed rows', async () => {
		mainQuery.mockResolvedValueOnce([{ code: '202610' }]); // resolveAcademicPeriodCode
		mainQuery.mockResolvedValueOnce([{ sectionCode: 'NRC1' }, { sectionCode: 'NRC2' }]); // uploaded
		rawQuery.mockResolvedValueOnce([
			{ sectionCode: 'NRC1', studentCode: 'A1', isGraded: true },
			{ sectionCode: 'NRC2', studentCode: 'A2', isGraded: true },
		]); // candidate enrollments
		// the validate+collapse query returns the surviving rows directly (NRC2/A2 dropped by the malla)
		mainQuery.mockResolvedValueOnce([{ sectionCode: 'NRC1', studentCode: 'A1' }]);

		const result = await repo.getAlumnosSecciones(1);

		// the repository returns the query result as-is (validation + collapse happen in SQL)
		expect(result).toEqual([{ sectionCode: 'NRC1', studentCode: 'A1' }]);

		// raw query gets the period code and the uploaded section codes only
		const [, rawParams] = rawQuery.mock.calls[0];
		expect(rawParams[0]).toBe('202610');
		expect(rawParams[1]).toEqual(['NRC1', 'NRC2']);

		// the validate+collapse query gets the candidate pairs as parallel arrays (section, student, graded)
		const [, validationParams] = mainQuery.mock.calls[2];
		expect(validationParams[0]).toEqual(['NRC1', 'NRC2']); // candidate section codes
		expect(validationParams[1]).toEqual(['A1', 'A2']); // candidate student codes
		expect(validationParams[2]).toEqual([true, true]); // graded flags
	});
});
