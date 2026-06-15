import type {
	CellErrorValue,
	CellFormulaValue,
	CellHyperlinkValue,
	CellRichTextValue,
	CellSharedFormulaValue,
	CellValue,
	Row,
	Worksheet,
} from 'exceljs';

type FormulaCell = CellFormulaValue | CellSharedFormulaValue;

const isRichText = (v: object): v is CellRichTextValue => 'richText' in v;
const isHyperlink = (v: object): v is CellHyperlinkValue => 'hyperlink' in v;
const isFormula = (v: object): v is FormulaCell => 'formula' in v || 'sharedFormula' in v;
const isError = (v: object): v is CellErrorValue => 'error' in v;

// ExcelJS returns objects (rich-text, hyperlink, formula, error) for non-plain cells, where a naive
// String(value) yields "[object Object]" and silently fails validation; resolve each variant to text.
function stringifyCellValue(value: CellValue): string {
	if (value === null || value === undefined) return '';
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'object') {
		if (isError(value)) return value.error;
		if (isRichText(value)) return value.richText.map((part) => part.text).join('');
		if (isHyperlink(value)) return value.text;
		if (isFormula(value)) return stringifyCellValue(value.result ?? '');
		return '';
	}
	return String(value);
}

export function normalizeCellText(value: CellValue): string {
	return stringifyCellValue(value)
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function readCell(row: Row, col: number): string {
	return normalizeCellText(row.getCell(col).value);
}

export function readI18nCells(
	row: Row,
	startCol: number,
	languages: string[],
): Record<string, string> {
	const result: Record<string, string> = {};
	languages.forEach((lang, i) => {
		result[lang] = readCell(row, startCol + i);
	});
	return result;
}

/**
 * Parses a worksheet into row objects keyed by the header cells in row 1.
 * Rows where every mapped cell is blank are skipped. Shared by the survey
 * Excel importers (GRA / PPP) so they use one parser.
 */
export function sheetToObjects(worksheet: Worksheet): Record<string, CellValue>[] {
	const headers = new Map<number, string>();
	worksheet.getRow(1).eachCell((cell, col) => {
		const header = normalizeCellText(cell.value);
		if (header) headers.set(col, header);
	});

	const rows: Record<string, CellValue>[] = [];
	for (let i = 2; i <= worksheet.rowCount; i++) {
		const row = worksheet.getRow(i);
		const obj: Record<string, CellValue> = {};
		let hasValue = false;
		for (const [col, header] of headers) {
			const value = row.getCell(col).value;
			obj[header] = value;
			if (normalizeCellText(value) !== '') hasValue = true;
		}
		if (hasValue) rows.push(obj);
	}
	return rows;
}
