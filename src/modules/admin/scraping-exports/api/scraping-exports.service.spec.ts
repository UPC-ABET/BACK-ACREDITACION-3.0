import * as ExcelJS from 'exceljs';

import { ScrapingExportsService } from './scraping-exports.service';
import { GRADE_RC_OBSERVATIONS } from '../model/scraping-exports.types';
import { gradesRcDescriptiveLabels } from '../model/scraping-exports.labels';

const row = (over: Partial<Record<string, unknown>> = {}) => ({
	sectionCode: 'NRC1',
	studentCode: 'A1',
	gradeTypeCode: 'TG205-T001',
	gradeTypePercentage: '20',
	grade: '14.80',
	qualificationStatusCode: 'TG404-T001',
	academicPeriod: '202610',
	courseCode: '1ASI0725',
	courseName: 'Arquitectura de Computadoras',
	studentName: 'Anahua Ancachi, Liz Maribel',
	careerCode: 'SW',
	gradeTypeName: 'EA1',
	qualificationStatusName: 'Asistió',
	source: 'Banner',
	scrapedAt: '2026-08-08 16:20',
	observations: [] as string[],
	hasObservations: false,
	...over,
});

// The RC bulk upload parses the file positionally, so the generated sheet has to keep the template
// column order exactly. This is the only thing standing between a reordered mapping and an upload
// that assigns weights to grades.
describe('ScrapingExportsService.renderGradesRc', () => {
	let rows: Array<ReturnType<typeof row>>;
	const service = new ScrapingExportsService({} as any, {} as any);

	beforeEach(() => {
		rows = [];
	});

	const givenRows = (given: Array<Partial<Record<string, unknown>>>) => {
		rows = given.map((r) => {
			const built = row(r);
			return { ...built, hasObservations: (built.observations ?? []).length > 0 };
		});
	};

	const loadWorkbook = async (buffer: Buffer) => {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
		return workbook;
	};

	const readSheet = (workbook: ExcelJS.Workbook, name: string) => {
		const sheet = workbook.getWorksheet(name)!;
		return sheet.getRows(1, sheet.rowCount)!.map((r) => r.values as unknown[]);
	};

	it('writes the six template columns in order', async () => {
		givenRows([row()]);

		const { fileName, buffer } = await service.renderGradesRc(rows);
		const [header, first] = readSheet(await loadWorkbook(buffer), 'Data');

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

	// The upload parses worksheets[0], so the descriptive sheet must never displace it.
	it('keeps the upload sheet first and puts the descriptive sheet after it', async () => {
		givenRows([row()]);

		const workbook = await loadWorkbook((await service.renderGradesRc(rows)).buffer);

		expect(workbook.worksheets.map((s) => s.name)).toEqual(['Data', 'Detalle']);
	});

	it('writes the descriptive sheet with codes resolved to names', async () => {
		givenRows([row({ observations: [GRADE_RC_OBSERVATIONS.FALLBACK_GRADE] })]);

		const [header, first] = readSheet(
			await loadWorkbook((await service.renderGradesRc(rows)).buffer),
			'Detalle',
		);

		expect(header.slice(1)).toEqual([
			'Periodo académico',
			'Código de sección',
			'Código de curso',
			'Nombre del curso',
			'Código del estudiante',
			'Nombre del estudiante',
			'Carrera',
			'Código del tipo de nota',
			'Tipo de nota',
			'Peso del tipo de nota (%)',
			'Nota',
			'Código del estado de calificación',
			'Estado de calificación',
			'Fuente',
			'Fecha de scrapeo',
			'Observación',
		]);
		expect(first.slice(1)).toEqual([
			'202610',
			'NRC1',
			'1ASI0725',
			'Arquitectura de Computadoras',
			'A1',
			'Anahua Ancachi, Liz Maribel',
			'SW',
			'TG205-T001',
			'EA1',
			'20',
			'14.80',
			'TG404-T001',
			'Asistió',
			'Banner',
			'2026-08-08 16:20',
			gradesRcDescriptiveLabels.es.observations[GRADE_RC_OBSERVATIONS.FALLBACK_GRADE],
		]);
	});

	// Regression coverage for a dropped test case: a row carrying 2+ observation codes must join
	// them with ' | ', not just resolve a single one.
	it('joins multiple observation codes with " | " in the descriptive sheet', async () => {
		givenRows([
			row({
				observations: [
					GRADE_RC_OBSERVATIONS.FALLBACK_GRADE,
					GRADE_RC_OBSERVATIONS.UNREGISTERED_STATUS,
				],
			}),
		]);

		const [, first] = readSheet(
			await loadWorkbook((await service.renderGradesRc(rows)).buffer),
			'Detalle',
		);

		expect(first[first.length - 1]).toBe(
			[
				gradesRcDescriptiveLabels.es.observations[GRADE_RC_OBSERVATIONS.FALLBACK_GRADE],
				gradesRcDescriptiveLabels.es.observations[GRADE_RC_OBSERVATIONS.UNREGISTERED_STATUS],
			].join(' | '),
		);
	});

	it('splits the rows between the sheets by whether they carry an observation', async () => {
		givenRows([
			row(),
			row({ sectionCode: 'NRC2', studentCode: 'A2' }),
			row({
				sectionCode: 'NRC3',
				studentCode: 'A3',
				source: 'Planner',
				observations: [GRADE_RC_OBSERVATIONS.COURSE_LEVEL_STATUS],
			}),
		]);

		const workbook = await loadWorkbook((await service.renderGradesRc(rows)).buffer);

		const uploadRows = readSheet(workbook, 'Data').slice(1);
		expect(uploadRows.map((r) => r[1])).toEqual(['NRC1', 'NRC2']);

		const detailRows = readSheet(workbook, 'Detalle').slice(1);
		expect(detailRows.map((r) => r[2])).toEqual(['NRC3']);
	});

	it('renders the requested language from the same persisted rows', async () => {
		givenRows([
			row({
				sectionCode: 'NRC2',
				studentCode: 'A2',
				gradeTypeCode: 'TF1',
				gradeTypeName: 'TF1',
				observations: [GRADE_RC_OBSERVATIONS.FALLBACK_GRADE],
			}),
		]);

		const workbook = await loadWorkbook((await service.renderGradesRc(rows, 'en')).buffer);
		expect(readSheet(workbook, 'Data')).toHaveLength(1);
		const [header, first] = readSheet(workbook, 'Details');

		expect(header[2]).toBe('Section code');
		expect(first[8]).toBe('TF1');
		expect(workbook.worksheets.map((s) => s.name)).toEqual(['Data', 'Details']);
	});
});

describe('ScrapingExportsService.fetchGradesRcRows', () => {
	let openGradesRcExport: jest.Mock;
	let service: ScrapingExportsService;

	beforeEach(() => {
		openGradesRcExport = jest.fn();
		service = new ScrapingExportsService({} as any, { openGradesRcExport } as any);
	});

	const emptyHandle = (close = jest.fn().mockResolvedValue(undefined)) => ({
		rows: async function* () {},
		close,
	});

	const oneRowHandle = (close = jest.fn().mockResolvedValue(undefined)) => ({
		rows: async function* () {
			yield row();
		},
		close,
	});

	const manyRowsHandle = (count: number, close = jest.fn().mockResolvedValue(undefined)) => ({
		rows: async function* () {
			for (let i = 0; i < count; i++) {
				yield row({ sectionCode: `NRC${i}` });
			}
		},
		close,
	});

	it('opens the merge exactly once and collects the resulting rows into one array', async () => {
		openGradesRcExport.mockResolvedValue(oneRowHandle());

		const rows = await service.fetchGradesRcRows(1);

		expect(openGradesRcExport).toHaveBeenCalledTimes(1);
		expect(openGradesRcExport).toHaveBeenCalledWith(1);
		expect(rows).toEqual([expect.objectContaining({ sectionCode: 'NRC1' })]);
	});

	it('collects a merge larger than one page in full', async () => {
		openGradesRcExport.mockResolvedValue(manyRowsHandle(2500));

		const rows = await service.fetchGradesRcRows(1);

		expect(rows).toHaveLength(2500);
	});

	it('rejects when the merge itself fails', async () => {
		openGradesRcExport.mockRejectedValue(new Error('merge failed'));

		await expect(service.fetchGradesRcRows(1)).rejects.toThrow('merge failed');
	});

	it('releases the handle once collection completes', async () => {
		const close = jest.fn().mockResolvedValue(undefined);
		openGradesRcExport.mockResolvedValue(emptyHandle(close));

		await service.fetchGradesRcRows(1);

		expect(close).toHaveBeenCalled();
	});

	it('releases the handle when reading rows fails after the merge succeeded', async () => {
		const close = jest.fn().mockResolvedValue(undefined);
		openGradesRcExport.mockResolvedValue({
			rows: () => {
				throw new Error('stream died');
			},
			close,
		});

		await expect(service.fetchGradesRcRows(1)).rejects.toThrow('stream died');
		expect(close).toHaveBeenCalled();
	});
});

describe('ScrapingExportsService sync export fetch/render split', () => {
	it('fetchStaffRows delegates to the repository and takes no lang', async () => {
		const getStaff = jest
			.fn()
			.mockResolvedValue([
				{ professorCode: 'N001', lastName: 'Doe', firstName: 'Jane', email: 'jane@upc.pe' },
			]);
		const service = new ScrapingExportsService({ getStaff } as any, {} as any);

		const rows = await service.fetchStaffRows(5);

		expect(getStaff).toHaveBeenCalledWith(5);
		expect(rows).toHaveLength(1);
	});

	it('renderStaffExcel applies the requested language without re-fetching', async () => {
		const service = new ScrapingExportsService({} as any, {} as any);
		const rows = [
			{ professorCode: 'N001', lastName: 'Doe', firstName: 'Jane', email: 'jane@upc.pe' },
		];

		const es = await service.renderStaffExcel(rows, 'es');
		const en = await service.renderStaffExcel(rows, 'en');

		expect(es.fileName).toBe('Docentes.xlsx');
		expect(en.fileName).toBe('Professors.xlsx');
	});
});
