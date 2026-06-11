/*
 * Generates test sheets for the organization-chart upload
 * (audit.fn_upload_charts / POST charts upload).
 *
 * Layout the backend's parseWorkbook expects (header row is ignored on parse):
 *   code | parentCode | title(en) | title(es) | email | entityType | entityCode
 *
 * Run:  node test-data/gen-org-chart-sheet.js
 */
const ExcelJS = require('../node_modules/exceljs');
const path = require('path');

// es template labels (DEFAULT_TEMPLATE_LANGUAGE = 'es'); languages order = ["en","es"]
const HEADERS = [
	'Código',
	'Padre',
	'Unidad académica (Inglés)',
	'Unidad académica (Español)',
	'Correo del responsable',
	'Tipo de entidad',
	'Código de entidad',
];

// [code, parentCode, titleEn, titleEs, email, entityType, entityCode]
const VALID_ROWS = [
	['PC01', '', 'Software Program Coordination', 'Coordinación de Programa de Software', 'prog-coord.eiscb@upc.edu.pe', 'Carrera', 'PROG_SOFT'],
	['AR01', 'PC01', 'Software Engineering Area', 'Área de Ingeniería de Software', 'area-coord.eiscb@upc.edu.pe', 'Area', ''],
	['SA01', 'AR01', 'Requirements Subarea', 'Subárea de Requisitos', 'subarea-coord.eiscb@upc.edu.pe', 'Subarea', ''],
	['CR01', 'SA01', 'Algorithms Course Coordination', 'Coordinación del Curso de Algoritmos', 'prof.juan.perez@upc.edu.pe', 'Curso', 'CC101'],
	['CR02', 'SA01', 'Databases Course Coordination', 'Coordinación del Curso de Bases de Datos', 'prof.maria.garcia@upc.edu.pe', 'Curso', 'CC102'],
	['CR03', 'AR01', 'Requirements Eng. Course', 'Curso de Ingeniería de Requisitos', 'prof.ana.torres@upc.edu.pe', 'Curso', 'CRS_REQ_ENG'],
	['GN01', 'PC01', 'Quality Committee', 'Comité de Calidad', 'coord.eiscb@upc.edu.pe', '', ''],
];

// One row per error code the PG function can emit.
const ERROR_ROWS = [
	['DUP', '', 'Dup A', 'Dup A', 'prog-coord.eiscb@upc.edu.pe', '', ''],            // duplicateCodeInFile
	['DUP', '', 'Dup B', 'Dup B', 'prog-coord.eiscb@upc.edu.pe', '', ''],            // duplicateCodeInFile
	['', '', 'No code', 'Sin código', 'prog-coord.eiscb@upc.edu.pe', '', ''],        // codeEmpty
	['E_TITLE', '', '', '', 'prog-coord.eiscb@upc.edu.pe', '', ''],                  // titleEmpty
	['E_MAIL', '', 'No email', 'Sin correo', '', '', ''],                            // emailEmpty
	['E_USER', '', 'No user', 'Usuario inexistente', 'ghost@nowhere.test', '', ''],  // userNotFound
	['E_STAFF', '', 'Not staff', 'No es personal', 'student.alex.medina@upc.edu.pe', '', ''], // staffNotFound (user exists, no staff)
	['E_ECWT', '', 'Code no type', 'Código sin tipo', 'coord.eiscb@upc.edu.pe', '', 'PROG_SOFT'], // entityCodeWithoutType
	['E_ETI', '', 'Bad type', 'Tipo inválido', 'coord.eiscb@upc.edu.pe', 'Departamento', ''],     // entityTypeInvalid
	['E_ENF', '', 'Missing program', 'Programa inexistente', 'coord.eiscb@upc.edu.pe', 'Carrera', 'NOPE'], // entityNotFound
	['E_PARENT', 'GHOST', 'Bad parent', 'Padre inexistente', 'coord.eiscb@upc.edu.pe', '', ''],   // parentNotFound
];

async function build(rows, fileName) {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Template');
	ws.addRow(HEADERS);
	const header = ws.getRow(1);
	header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
	header.eachCell((cell, col) => {
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
		ws.getColumn(col).width = HEADERS[col - 1].length + 2;
	});
	rows.forEach((r) => ws.addRow(r));
	const out = path.join(__dirname, fileName);
	await wb.xlsx.writeFile(out);
	console.log('wrote', out, `(${rows.length} data rows)`);
}

(async () => {
	await build(VALID_ROWS, 'org-chart-valid.xlsx');
	await build(ERROR_ROWS, 'org-chart-errors.xlsx');
})();
