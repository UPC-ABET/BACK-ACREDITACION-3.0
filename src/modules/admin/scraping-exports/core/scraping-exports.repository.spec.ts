import { ScrapingExportsRepository } from './scraping-exports.repository';

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
