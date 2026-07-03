jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('../core/grades-rv-upload.repository', () => ({ GradesRvUploadRepository: class {} }), {
	virtual: true,
});
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});
jest.mock(
	'../../rubrics/model/rubrics-template.labels',
	() => ({
		gradeTypesList: [{ code: 'TG205-T006', name: 'TF' }],
	}),
	{ virtual: true },
);

import * as ExcelJS from 'exceljs';
import { GradesRvUploadService } from './grades-rv-upload.service';

const uploadLogServiceStub: any = {
	assertRollbackable: jest.fn(),
	assertAcademicPeriodExists: jest.fn(),
};

// Column layout (positional):
//  1:ESCUELA 2:CARRERA 3:COMISION 4:CURSO 5:ALUMNO 6:SECCION
//  7:DOCENTE 8:TIPOEVALUACION 9-15:O1-O7
// 16:CODIGOPROYECTO 17:PROYECTO(ES) 18:PROYECTO(EN) 19:DESCPROYECTO(ES) 20:DESCPROYECTO(EN)
const HEADER = [
	'Código de escuela',
	'Código de carrera',
	'Código de comisión',
	'Código de curso',
	'Código del alumno',
	'Código de sección',
	'Código del docente',
	'Código de tipo de nota',
	'O1',
	'O2',
	'O3',
	'O4',
	'O5',
	'O6',
	'O7',
	'Código del proyecto',
	'Nombre del proyecto (ES)',
	'Nombre del proyecto (EN)',
	'Descripción del proyecto (ES)',
	'Descripción del proyecto (EN)',
];

async function makeXlsx(rows: (string | null)[][]): Promise<Buffer> {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Sheet1');
	ws.addRow(HEADER);
	rows.forEach((r) => ws.addRow(r));
	const buf = await wb.xlsx.writeBuffer();
	return Buffer.from(buf);
}

function makeRepository(uploadFnResult: any[]) {
	const calls: { uploadArgs?: any[] } = {};
	const repository: any = {
		callUploadFunction: jest.fn((...args: any[]) => {
			calls.uploadArgs = args;
			return Promise.resolve(uploadFnResult);
		}),
		callRollbackFunction: jest.fn().mockResolvedValue(undefined),
	};
	return { repository, calls };
}

describe('GradesRvUploadService — positional parsing', () => {
	it('sends structured rows with new column layout', async () => {
		const { repository, calls } = makeRepository([
			{ row_number: null, error_code: null, upload_log_id: 42 },
		]);
		const service = new GradesRvUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			[
				'ESCEL',
				'ELE',
				'EAC',
				'1AEL0236',
				'20171F052',
				'17086',
				'N00612627',
				'TG205-T006',
				'1.4',
				'1.5',
				'1',
				'1.7',
				'1.8',
				'2',
				'1.9',
				'PROY-EL-001',
				'Proyecto Electrónica',
				'Electronics Project',
				'Descripción ES',
				'Description EN',
			],
		]);
		const result = await service.processUpload(buffer, 'grades-rv.xlsx', 7, 1, {} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			escuelaCode: 'ESCEL',
			carreraCode: 'ELE',
			commissionCode: 'EAC',
			courseCode: '1AEL0236',
			studentCode: '20171F052',
			sectionCode: '17086',
			professorCode: 'N00612627',
			gradeTypeCode: 'TG205-T006',
			o1: '1.4',
			o2: '1.5',
			o7: '1.9',
			projectCode: 'PROY-EL-001',
			projectNameEs: 'Proyecto Electrónica',
			projectNameEn: 'Electronics Project',
			projectDescEs: 'Descripción ES',
			projectDescEn: 'Description EN',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository([
			{ row_number: 2, error_code: 'courseNotFound', upload_log_id: null },
		]);
		const service = new GradesRvUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			[
				'ESCEL',
				'ELE',
				'EAC',
				'INVALID-COURSE',
				'20171F052',
				'17086',
				'N00612627',
				'TG205-T006',
				'1',
				null,
				null,
				null,
				null,
				null,
				null,
				'PROY-001',
				'Proyecto',
				'',
				'',
				'',
			],
		]);
		const result = await service.processUpload(buffer, 'grades-rv.xlsx', 1, 1, {
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('GradesRvUploadService — template', () => {
	it('builds a Template sheet and an instructions sheet with localized headers', async () => {
		const service = new GradesRvUploadService({} as any, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaNotasRV.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);

		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Código de sección');
		expect(header).toContain('Código del proyecto');
		expect(header).toContain('O1');
		expect(header).toContain('O7');
		expect(header).not.toContain('Código del outcome');

		expect(wb.worksheets.length).toBeGreaterThanOrEqual(2);
		expect(wb.getWorksheet('Instrucciones de llenado')).toBeDefined();
	});
});
