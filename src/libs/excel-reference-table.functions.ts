import * as ExcelJS from 'exceljs';

/**
 * Renders a titled two-column (code, name) reference table starting at startRow.
 * Returns the row number right after the table's last row.
 */
export function addReferenceTable(
	sheet: ExcelJS.Worksheet,
	startRow: number,
	title: string,
	columnLabels: { code: string; name: string },
	rows: Array<{ code: string; name: string }>,
): number {
	const titleRow = sheet.getRow(startRow);
	const titleCell = titleRow.getCell(1);
	titleCell.value = title;
	titleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
	titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
	titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
	sheet.mergeCells(startRow, 1, startRow, 2);
	titleRow.height = 22;

	const subRow = sheet.getRow(startRow + 1);
	[columnLabels.code, columnLabels.name].forEach((h, i) => {
		const cell = subRow.getCell(i + 1);
		cell.value = h;
		cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
	});

	rows.forEach((row, idx) => {
		const r = sheet.getRow(startRow + 2 + idx);
		r.getCell(1).value = row.code;
		r.getCell(2).value = row.name;
		[1, 2].forEach((c) => {
			const cell = r.getCell(c);
			cell.alignment = { vertical: 'middle' };
			cell.border = {
				bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
				right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
			};
		});
	});

	return startRow + 2 + rows.length;
}
