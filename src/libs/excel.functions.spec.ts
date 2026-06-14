import type { CellValue, Row } from 'exceljs';

import { normalizeCellText, readCell } from './excel.functions';

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
