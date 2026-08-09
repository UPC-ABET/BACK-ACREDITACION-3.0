import * as ExcelJS from 'exceljs';

import { ScrapingExportsService } from './scraping-exports.service';

// The RC bulk upload parses the file positionally, so the generated sheet has to keep the template
// column order exactly. This is the only thing standing between a reordered mapping and an upload
// that assigns weights to grades.
describe('ScrapingExportsService.generateGradesRc', () => {
	const getGradesRcRows = jest.fn();
	const service = new ScrapingExportsService({} as any, { getGradesRcRows } as any);

	beforeEach(() => jest.clearAllMocks());

	const readSheet = async (buffer: Buffer) => {
		const workbook = new ExcelJS.Workbook();
		// exceljs types `load` against an older Buffer declaration than the installed @types/node.
		await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
		const sheet = workbook.getWorksheet('Data')!;
		return sheet.getRows(1, sheet.rowCount)!.map((row) => row.values as unknown[]);
	};

	it('writes the six template columns in order', async () => {
		getGradesRcRows.mockResolvedValueOnce([
			{
				sectionCode: 'NRC1',
				studentCode: 'A1',
				gradeTypeCode: 'TG205-T001',
				gradeTypePercentage: '20',
				grade: '14.80',
				qualificationStatusCode: 'TG404-T001',
			},
		]);

		const { buffer, fileName } = await service.generateGradesRc(1);
		const [header, first] = await readSheet(buffer);

		expect(fileName).toBe('NotasRC.xlsx');
		expect(header.slice(1)).toEqual([
			'Código de sección',
			'Código del alumno',
			'Código de tipo de nota',
			'Peso del tipo de nota (%)',
			'Nota',
			'Código de estado de calificación',
		]);
		expect(first.slice(1)).toEqual(['NRC1', 'A1', 'TG205-T001', '20', '14.80', 'TG404-T001']);
	});

	it('keeps the raw grade type code of a grade rescued by the fallback', async () => {
		getGradesRcRows.mockResolvedValueOnce([
			{
				sectionCode: 'NRC2',
				studentCode: 'A2',
				gradeTypeCode: 'TF1',
				gradeTypePercentage: '40',
				grade: '18.00',
				qualificationStatusCode: 'TG404-T001',
			},
		]);

		const { buffer } = await service.generateGradesRc(1, 'en');
		const [header, first] = await readSheet(buffer);

		expect(header[1]).toBe('Section code');
		expect(first[3]).toBe('TF1');
	});
});
