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

/** One data row from {@link sheetToObjects}, paired with its actual worksheet row
 *  number — rows with every mapped cell blank are skipped during parsing, so the
 *  array index alone (`i + 2`) does not reliably map back to the sheet once a blank
 *  row appears anywhere before it. */
export interface SheetRow {
	rowNumber: number;
	values: Record<string, CellValue>;
}

/**
 * Parses a worksheet into row objects keyed by the header cells in row 1, each
 * paired with its real worksheet row number (see {@link SheetRow}). Rows where
 * every mapped cell is blank are skipped. Shared by the survey Excel importers
 * (GRA / PPP) so they use one parser.
 */
export function sheetToObjects(worksheet: Worksheet): SheetRow[] {
	const headers = new Map<number, string>();
	worksheet.getRow(1).eachCell((cell, col) => {
		const header = normalizeCellText(cell.value);
		if (header) headers.set(col, header);
	});

	const rows: SheetRow[] = [];
	for (let i = 2; i <= worksheet.rowCount; i++) {
		const row = worksheet.getRow(i);
		const values: Record<string, CellValue> = {};
		let hasValue = false;
		for (const [col, header] of headers) {
			const value = row.getCell(col).value;
			values[header] = value;
			if (normalizeCellText(value) !== '') hasValue = true;
		}
		if (hasValue) rows.push({ rowNumber: i, values });
	}
	return rows;
}

/**
 * Appends an error column to a parsed workbook, one joined message per failed
 * row, so the user can fix the file they uploaded rather than a report about it.
 * The column lands right after whatever columns the *uploaded* sheet actually
 * has (reusing an existing header of the same name if the file was annotated
 * once already) rather than after the template's column count — the parsers
 * accept files with extra or missing columns, so the template's shape and the
 * uploaded sheet's shape can legitimately differ.
 *
 * `headerText` is the caller's, because the header is display text in the
 * user's language while this layer is language-agnostic.
 */
export function annotateRowErrors(
	worksheet: Worksheet,
	rowErrors: Map<number, string[]>,
	headerText: string,
): void {
	const headerRow = worksheet.getRow(1);
	let errorColumn = worksheet.columnCount + 1;
	headerRow.eachCell((cell, col) => {
		if (normalizeCellText(cell.value) === headerText) errorColumn = col;
	});

	const headerCell = headerRow.getCell(errorColumn);
	headerCell.value = headerText;
	headerCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
	headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
	worksheet.getColumn(errorColumn).width = 60;

	for (const [rowNum, messages] of rowErrors) {
		worksheet.getRow(rowNum).getCell(errorColumn).value = messages.join(' | ');
	}
}
