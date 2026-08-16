import * as ExcelJS from 'exceljs';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import { buildCompetenceLabels, annotateUploadErrors } from './ppp-survey.service';

function config(id: number, commissionTypeCode?: string): OutcomeConfigEntity {
	return {
		id,
		outcome: commissionTypeCode
			? { programCommission: { commissionType: { code: commissionTypeCode } } }
			: undefined,
	} as unknown as OutcomeConfigEntity;
}

describe('buildCompetenceLabels', () => {
	it('numbers specific configs as CE1..CEn and general ones as CG1..CGn, independently', () => {
		const configs = [
			config(10, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
			config(11, TYPE_CODES.COMMISSION_TYPE.GENERAL),
			config(12, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
			config(13, TYPE_CODES.COMMISSION_TYPE.GENERAL),
		];

		const labels = buildCompetenceLabels(configs);

		expect(labels.get(10)).toBe('CE1');
		expect(labels.get(12)).toBe('CE2');
		expect(labels.get(11)).toBe('CG1');
		expect(labels.get(13)).toBe('CG2');
	});

	it('keeps CE/CG grouped even when specific and general configs interleave by order', () => {
		// Same order as they'd come back from a query sorted only by `extra.order`, where
		// specific config #1 and general config #1 can both have order=1 and land adjacent.
		const configs = [
			config(1, TYPE_CODES.COMMISSION_TYPE.GENERAL),
			config(2, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
			config(3, TYPE_CODES.COMMISSION_TYPE.GENERAL),
			config(4, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
		];

		const labels = buildCompetenceLabels(configs);

		// Grouped, not interleaved: every CE label before every CG label, regardless of
		// the order configs 1-4 came back in.
		expect(labels.get(2)).toBe('CE1');
		expect(labels.get(4)).toBe('CE2');
		expect(labels.get(1)).toBe('CG1');
		expect(labels.get(3)).toBe('CG2');
		expect([...labels.values()]).toEqual(['CE1', 'CE2', 'CG1', 'CG2']);
	});

	it('treats a config with no commission type (relation not loaded / missing) as general', () => {
		const configs = [config(1, TYPE_CODES.COMMISSION_TYPE.SPECIFIC), config(2, undefined)];

		const labels = buildCompetenceLabels(configs);

		expect(labels.get(1)).toBe('CE1');
		expect(labels.get(2)).toBe('CG1');
	});

	it('returns an empty map for no configs', () => {
		expect(buildCompetenceLabels([]).size).toBe(0);
	});
});

describe('annotateUploadErrors', () => {
	function buildWorksheet(headers: string[]): ExcelJS.Worksheet {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Plantilla');
		sheet.addRow(headers);
		sheet.addRow(['EST-1']);
		sheet.addRow(['EST-2']);
		return sheet;
	}

	it("writes the Errores column right after the sheet's own last column, not a fixed count", () => {
		// The uploaded sheet has 5 columns — more than a 2-column template would have —
		// so the error column must land at 6, computed from the sheet itself.
		const sheet = buildWorksheet(['Codigo Alumno', 'CE1', 'CE2', 'CG1', 'CG2']);

		annotateUploadErrors(sheet, new Map([[2, ['Fila inválida']]]));

		expect(sheet.getRow(1).getCell(6).value).toBe('Errores');
		expect(sheet.getRow(2).getCell(6).value).toBe('Fila inválida');
		// The row untouched by rowErrors keeps its error cell empty.
		expect(sheet.getRow(3).getCell(6).value).toBeNull();
	});

	it('reuses an existing "Errores" header instead of appending a second one', () => {
		const sheet = buildWorksheet(['Codigo Alumno', 'CE1', 'Errores']);

		annotateUploadErrors(sheet, new Map([[3, ['Segundo intento fallido']]]));

		expect(sheet.getRow(1).getCell(3).value).toBe('Errores');
		expect(sheet.getRow(1).getCell(4).value).toBeNull();
		expect(sheet.getRow(3).getCell(3).value).toBe('Segundo intento fallido');
	});

	it('places each message on its real worksheet row, not on a value derived from array position', () => {
		const sheet = buildWorksheet(['Codigo Alumno']);
		// Row 3 (the second data row) is the one with the error — row 2 must stay clean.
		annotateUploadErrors(sheet, new Map([[3, ['No se encontró al alumno']]]));

		expect(sheet.getRow(2).getCell(2).value).toBeNull();
		expect(sheet.getRow(3).getCell(2).value).toBe('No se encontró al alumno');
	});

	it('joins multiple messages for the same row with " | "', () => {
		const sheet = buildWorksheet(['Codigo Alumno']);
		annotateUploadErrors(sheet, new Map([[2, ['Error uno', 'Error dos']]]));

		expect(sheet.getRow(2).getCell(2).value).toBe('Error uno | Error dos');
	});
});
