import { PassThrough } from 'node:stream';
import * as ExcelJS from 'exceljs';

import { ScrapingExportsService } from './scraping-exports.service';
import { GRADE_RC_OBSERVATIONS } from '../model/scraping-exports.types';
import { gradesRcDescriptiveLabels } from '../model/scraping-exports.labels';

// The RC bulk upload parses the file positionally, so the generated sheet has to keep the template
// column order exactly. This is the only thing standing between a reordered mapping and an upload
// that assigns weights to grades.
describe('ScrapingExportsService.prepareGradesRc', () => {
	// Stands in for the scratch-table reader: the service walks it once per worksheet, so `rows` has
	// to hand back a fresh generator each time it is called. The observation split is reproduced here
	// the way READ_GRADES_RC_PAGE_SQL does it, so the sheets get the same disjoint halves they would
	// in production.
	const exportedRows: Array<{ observations?: string[] }> = [];
	const openGradesRcExport = jest.fn().mockImplementation(() =>
		Promise.resolve({
			rows: async function* (withObservations: boolean) {
				for (const r of exportedRows) {
					if ((r.observations ?? []).length > 0 === withObservations) yield r;
				}
			},
			close: jest.fn().mockResolvedValue(undefined),
		}),
	);
	const givenRows = (rows: Array<{ observations?: string[] }>) => {
		exportedRows.length = 0;
		exportedRows.push(...rows);
	};
	const service = new ScrapingExportsService({} as any, { openGradesRcExport } as any);

	beforeEach(() => jest.clearAllMocks());

	// The export writes into whatever Writable it is handed (the response, in production), so the
	// test hands it a PassThrough and collects the workbook out of it.
	const streamToBuffer = async (lang?: string) => {
		const stream = new PassThrough();
		const chunks: Buffer[] = [];
		stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
		const finished = new Promise<void>((resolve) => stream.on('end', () => resolve()));

		const prepared = await service.prepareGradesRc(1, lang);
		await prepared.write(stream);
		await finished;

		return { ...prepared, buffer: Buffer.concat(chunks) };
	};

	const loadWorkbook = async (buffer: Buffer) => {
		const workbook = new ExcelJS.Workbook();
		// exceljs types `load` against an older Buffer declaration than the installed @types/node.
		await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
		return workbook;
	};

	const readSheet = (workbook: ExcelJS.Workbook, name: string) => {
		const sheet = workbook.getWorksheet(name)!;
		return sheet.getRows(1, sheet.rowCount)!.map((row) => row.values as unknown[]);
	};

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
		...over,
	});

	it('writes the six template columns in order', async () => {
		givenRows([row()]);

		const { fileName, buffer } = await streamToBuffer();
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

		const workbook = await loadWorkbook((await streamToBuffer()).buffer);

		expect(workbook.worksheets.map((s) => s.name)).toEqual(['Data', 'Detalle']);
	});

	it('writes the descriptive sheet with codes resolved to names', async () => {
		// Carries an observation so it lands in the descriptive sheet: that is what the two sheets
		// are split on.
		givenRows([row({ observations: [GRADE_RC_OBSERVATIONS.FALLBACK_GRADE] })]);

		const [header, first] = readSheet(
			await loadWorkbook((await streamToBuffer()).buffer),
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

	// The observation codes are what tell a reviewer which rows to look at before uploading, so they
	// have to reach the sheet as readable text, not as raw codes.
	it('resolves observation codes to localized text, joined when a row has several', async () => {
		givenRows([
			row({
				observations: [
					GRADE_RC_OBSERVATIONS.FALLBACK_GRADE,
					GRADE_RC_OBSERVATIONS.ZERO_GRADE_UNEXPLAINED,
				],
			}),
		]);

		const [, first] = readSheet(await loadWorkbook((await streamToBuffer()).buffer), 'Detalle');

		// Asserted against the labels themselves: the wording is meant to be reworded for whoever
		// reads the file, and a test pinned to a phrase would break on every rewrite.
		const observations = gradesRcDescriptiveLabels.es.observations;
		expect(first[16]).toBe(
			[
				observations[GRADE_RC_OBSERVATIONS.FALLBACK_GRADE],
				observations[GRADE_RC_OBSERVATIONS.ZERO_GRADE_UNEXPLAINED],
			].join(' | '),
		);
	});

	// The sheets are disjoint halves: the upload sheet holds only rows that came out complete, so it
	// can be uploaded without a single rejection, and anything with something to say about it goes to
	// the review sheet -- including rows that would upload fine, like a withdrawn student's 0/RET.
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

		const workbook = await loadWorkbook((await streamToBuffer()).buffer);

		const uploadRows = readSheet(workbook, 'Data').slice(1);
		expect(uploadRows.map((r) => r[1])).toEqual(['NRC1', 'NRC2']);

		const detailRows = readSheet(workbook, 'Detalle').slice(1);
		expect(detailRows.map((r) => r[2])).toEqual(['NRC3']);
	});

	// A rescued row always carries FALLBACK_GRADE in production, so it is the review sheet that has
	// to keep the raw code -- asserting it on the upload sheet would pin a state that cannot happen.
	it('keeps the raw grade type code of a grade rescued by the fallback', async () => {
		givenRows([
			row({
				sectionCode: 'NRC2',
				studentCode: 'A2',
				gradeTypeCode: 'TF1',
				gradeTypeName: 'TF1',
				observations: [GRADE_RC_OBSERVATIONS.FALLBACK_GRADE],
			}),
		]);

		const workbook = await loadWorkbook((await streamToBuffer('en')).buffer);
		expect(readSheet(workbook, 'Data')).toHaveLength(1);
		const [header, first] = readSheet(workbook, 'Details');

		expect(header[2]).toBe('Section code');
		expect(first[8]).toBe('TF1');
		expect(workbook.worksheets.map((s) => s.name)).toEqual(['Data', 'Details']);
	});
});

describe('ScrapingExportsService.generateGradesRc', () => {
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

	it('resolves with a downloadable file once the merge finishes', async () => {
		openGradesRcExport.mockResolvedValue(emptyHandle());

		const result = await service.generateGradesRc(1, 'es');

		expect(result.fileName).toBe('NotasRC.xlsx');
		expect(Buffer.isBuffer(result.buffer)).toBe(true);
	});

	it('rejects when the merge itself fails', async () => {
		openGradesRcExport.mockRejectedValue(new Error('merge failed'));

		await expect(service.generateGradesRc(1, 'es')).rejects.toThrow('merge failed');
	});

	it('releases the runner once generation completes', async () => {
		const close = jest.fn().mockResolvedValue(undefined);
		openGradesRcExport.mockResolvedValue(emptyHandle(close));

		await service.generateGradesRc(1, 'es');

		expect(close).toHaveBeenCalled();
	});

	it('releases the runner when writing the workbook fails after the merge succeeded', async () => {
		const close = jest.fn().mockResolvedValue(undefined);
		openGradesRcExport.mockResolvedValue({
			rows: () => {
				throw new Error('stream died');
			},
			close,
		});

		await expect(service.generateGradesRc(1, 'es')).rejects.toThrow('stream died');

		expect(close).toHaveBeenCalled();
	});
});
