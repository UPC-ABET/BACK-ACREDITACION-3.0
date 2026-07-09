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

	it('returns [] without touching the raw DB when the study plan has no courses', async () => {
		mainQuery.mockResolvedValueOnce([{ code: '202610' }]); // resolveAcademicPeriodCode
		mainQuery.mockResolvedValueOnce([{ sectionCode: 'NRC1' }]); // uploaded sections
		mainQuery.mockResolvedValueOnce([]); // study plan pairs

		await expect(repo.getAlumnosSecciones(1)).resolves.toEqual([]);
		expect(rawQuery).not.toHaveBeenCalled();
	});

	it('passes the study-plan (student, course) pairs into the raw query and maps its rows', async () => {
		mainQuery.mockResolvedValueOnce([{ code: '202610' }]); // resolveAcademicPeriodCode
		mainQuery.mockResolvedValueOnce([{ sectionCode: 'NRC1' }, { sectionCode: 'NRC2' }]);
		mainQuery.mockResolvedValueOnce([
			{ studentCode: 'A1', courseCode: 'CS1010' },
			{ studentCode: 'A2', courseCode: 'CS2020' },
		]);
		rawQuery.mockResolvedValueOnce([{ sectionCode: 'NRC1', studentCode: 'A1' }]);

		const result = await repo.getAlumnosSecciones(1);

		expect(result).toEqual([{ sectionCode: 'NRC1', studentCode: 'A1' }]);

		const [, params] = rawQuery.mock.calls[0];
		expect(params[0]).toBe('202610'); // period code
		expect(params[1]).toEqual(['NRC1', 'NRC2']); // uploaded section codes
		expect(params[2]).toEqual(['A1', 'A2']); // allowed student codes
		expect(params[3]).toEqual(['CS1010', 'CS2020']); // allowed course codes
	});
});
