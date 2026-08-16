import * as ExcelJS from 'exceljs';
import type { CellValue, Row } from 'exceljs';

import { normalizeCellText, readCell, sheetToObjects } from './excel.functions';

describe('normalizeCellText', () => {
	it('returns an empty string for null and undefined', () => {
		expect(normalizeCellText(null)).toBe('');
		expect(normalizeCellText(undefined)).toBe('');
	});

	it('trims leading and trailing whitespace', () => {
		expect(normalizeCellText('  ABC123  ')).toBe('ABC123');
	});

	it('collapses internal whitespace runs, tabs and non-breaking spaces', () => {
		expect(normalizeCellText('John   Doe\t\tSmith')).toBe('John Doe Smith');
	});

	it('strips zero-width characters', () => {
		const input = `A${String.fromCharCode(0x200b)}B${String.fromCharCode(0x200c)}${String.fromCharCode(0xfeff)}C`;
		expect(normalizeCellText(input)).toBe('ABC');
	});

	it('stringifies numbers and booleans', () => {
		expect(normalizeCellText(42)).toBe('42');
		expect(normalizeCellText(true)).toBe('true');
	});

	it('resolves rich-text objects to their concatenated text', () => {
		const value: CellValue = { richText: [{ text: ' CS' }, { text: '101 ' }] };
		expect(normalizeCellText(value)).toBe('CS101');
	});

	it('resolves hyperlink objects to their display text', () => {
		const value: CellValue = { text: ' user@mail.com ', hyperlink: 'mailto:user@mail.com' };
		expect(normalizeCellText(value)).toBe('user@mail.com');
	});

	it('resolves formula objects to their computed result', () => {
		const value: CellValue = { formula: 'A1&A2', result: ' PROG_SOFT ' };
		expect(normalizeCellText(value)).toBe('PROG_SOFT');
	});

	it('resolves error objects to their error token', () => {
		const value: CellValue = { error: '#N/A' };
		expect(normalizeCellText(value)).toBe('#N/A');
	});
});

describe('readCell', () => {
	it('normalizes the value at the requested column', () => {
		const row = {
			getCell: (col: number) => ({ value: col === 2 ? '  hello  ' : null }),
		} as unknown as Row;
		expect(readCell(row, 2)).toBe('hello');
		expect(readCell(row, 1)).toBe('');
	});
});

describe('sheetToObjects', () => {
	function buildSheet(rows: Array<string[] | null>): ExcelJS.Worksheet {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Sheet1');
		sheet.addRow(['Codigo Alumno', 'Nombre']);
		for (const row of rows) {
			// `addRow(undefined)` still advances the row index in ExcelJS the same way a
			// visually-blank row does when a user leaves a gap in the middle of a file.
			sheet.addRow(row ?? undefined);
		}
		return sheet;
	}

	it('pairs each row with its own worksheet row number', () => {
		const sheet = buildSheet([
			['EST-1', 'Ana'],
			['EST-2', 'Luis'],
		]);
		const rows = sheetToObjects(sheet);
		expect(rows).toEqual([
			{ rowNumber: 2, values: { 'Codigo Alumno': 'EST-1', Nombre: 'Ana' } },
			{ rowNumber: 3, values: { 'Codigo Alumno': 'EST-2', Nombre: 'Luis' } },
		]);
	});

	it('skips blank rows without shifting the row number of the data that follows', () => {
		const sheet = buildSheet([
			['EST-1', 'Ana'], // row 2
			null, // row 3, blank — must be skipped, not counted as data
			['EST-2', 'Luis'], // row 4
		]);
		const rows = sheetToObjects(sheet);
		// Array index 1 is EST-2, but its real worksheet row is 4, not 3 (index + 2) —
		// this is exactly what a naive `i + 2` gets wrong once a blank row is involved.
		expect(rows).toEqual([
			{ rowNumber: 2, values: { 'Codigo Alumno': 'EST-1', Nombre: 'Ana' } },
			{ rowNumber: 4, values: { 'Codigo Alumno': 'EST-2', Nombre: 'Luis' } },
		]);
	});
});
