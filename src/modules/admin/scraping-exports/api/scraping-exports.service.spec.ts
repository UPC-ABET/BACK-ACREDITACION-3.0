import { PassThrough } from 'node:stream';
import * as ExcelJS from 'exceljs';

import { ScrapingExportsService } from './scraping-exports.service';
import { GRADE_RC_OBSERVATIONS } from '../core/grades-rc-export.sql';
import { gradesRcDescriptiveLabels } from '../model/scraping-exports.labels';

// The RC bulk upload parses the file positionally, so the generated sheet has to keep the template
// column order exactly. This is the only thing standing between a reordered mapping and an upload
// that assigns weights to grades.
describe('ScrapingExportsService.streamGradesRc', () => {
	const getGradesRcRows = jest.fn();
	const service = new ScrapingExportsService({} as any, { getGradesRcRows } as any);

	beforeEach(() => jest.clearAllMocks());

	// The export streams straight into the response, so the test stands in a PassThrough carrying a
	// setHeader stub and collects what gets written.
	const captureResponse = () => {
		const stream = new PassThrough();
		const chunks: Buffer[] = [];
		const headers: Record<string, string> = {};

		stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
		(stream as unknown as { setHeader: (k: string, v: string) => void }).setHeader = (
			key,
			value,
		) => {
			headers[key] = value;
		};

		const finished = new Promise<void>((resolve) => stream.on('end', () => resolve()));
		return {
			res: stream as never,
			headers,
			read: async () => {
				await finished;
				return Buffer.concat(chunks);
			},
		};
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
		gradeTypeName: 'EA1',
		qualificationStatusName: 'Asistió',
		source: 'Banner',
		scrapedAt: '2026-08-08 16:20',
		observations: [] as string[],
		...over,
	});

	it('writes the six template columns in order', async () => {
		getGradesRcRows.mockResolvedValueOnce([row()]);

		const { res, headers, read } = captureResponse();
		await service.streamGradesRc(1, undefined, res);
		const [header, first] = readSheet(await loadWorkbook(await read()), 'Data');

		expect(headers['Content-Disposition']).toContain('NotasRC.xlsx');
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
		getGradesRcRows.mockResolvedValueOnce([row()]);

		const { res, read } = captureResponse();
		await service.streamGradesRc(1, undefined, res);
		const workbook = await loadWorkbook(await read());

		expect(workbook.worksheets.map((s) => s.name)).toEqual(['Data', 'Detalle']);
	});

	it('writes the descriptive sheet with codes resolved to names', async () => {
		getGradesRcRows.mockResolvedValueOnce([row()]);

		const { res, read } = captureResponse();
		await service.streamGradesRc(1, undefined, res);
		const [header, first] = readSheet(await loadWorkbook(await read()), 'Detalle');

		expect(header.slice(1)).toEqual([
			'Periodo académico',
			'Código de sección',
			'Código de curso',
			'Nombre del curso',
			'Código del estudiante',
			'Nombre del estudiante',
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
			'TG205-T001',
			'EA1',
			'20',
			'14.80',
			'TG404-T001',
			'Asistió',
			'Banner',
			'2026-08-08 16:20',
			// no observation: ExcelJS drops the trailing empty cell, so it is absent rather than ''
		]);
	});

	// The observation codes are what tell a reviewer which rows to look at before uploading, so they
	// have to reach the sheet as readable text, not as raw codes.
	it('resolves observation codes to localized text, joined when a row has several', async () => {
		getGradesRcRows.mockResolvedValueOnce([
			row({
				observations: [
					GRADE_RC_OBSERVATIONS.FALLBACK_GRADE,
					GRADE_RC_OBSERVATIONS.ZERO_GRADE_UNEXPLAINED,
				],
			}),
		]);

		const { res, read } = captureResponse();
		await service.streamGradesRc(1, undefined, res);
		const [, first] = readSheet(await loadWorkbook(await read()), 'Detalle');

		// Asserted against the labels themselves: the wording is meant to be reworded for whoever
		// reads the file, and a test pinned to a phrase would break on every rewrite.
		const observations = gradesRcDescriptiveLabels.es.observations;
		expect(first[15]).toBe(
			[
				observations[GRADE_RC_OBSERVATIONS.FALLBACK_GRADE],
				observations[GRADE_RC_OBSERVATIONS.ZERO_GRADE_UNEXPLAINED],
			].join(' | '),
		);
	});

	// Both sheets describe the same rows -- the scoping to loaded sections happens in SQL, so neither
	// sheet may drop or add rows on its own.
	it('writes the same rows in both sheets', async () => {
		getGradesRcRows.mockResolvedValueOnce([
			row(),
			row({ sectionCode: 'NRC2', studentCode: 'A2', source: 'Planner' }),
		]);

		const { res, read } = captureResponse();
		await service.streamGradesRc(1, undefined, res);
		const workbook = await loadWorkbook(await read());

		expect(readSheet(workbook, 'Data').slice(1)).toHaveLength(2);

		const detailRows = readSheet(workbook, 'Detalle').slice(1);
		expect(detailRows).toHaveLength(2);
		expect(detailRows.map((r) => r[13])).toEqual(['Banner', 'Planner']);
	});

	it('keeps the raw grade type code of a grade rescued by the fallback', async () => {
		getGradesRcRows.mockResolvedValueOnce([
			row({ sectionCode: 'NRC2', studentCode: 'A2', gradeTypeCode: 'TF1', gradeTypeName: 'TF1' }),
		]);

		const { res, read } = captureResponse();
		await service.streamGradesRc(1, 'en', res);
		const workbook = await loadWorkbook(await read());
		const [header, first] = readSheet(workbook, 'Data');

		expect(header[1]).toBe('Section code');
		expect(first[3]).toBe('TF1');
		expect(workbook.worksheets.map((s) => s.name)).toEqual(['Data', 'Details']);
	});
});
