jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('../core/grades-rc-upload.repository', () => ({ GradesRcUploadRepository: class {} }), {
	virtual: true,
});
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});

import * as ExcelJS from 'exceljs';
import { GradesRcUploadService } from './grades-rc-upload.service';

const uploadLogServiceStub: any = {
	assertRollbackable: jest.fn(),
	assertAcademicPeriodExists: jest.fn(),
};

const HEADER = ['Section', 'Student', 'GradeType', 'Percentage', 'Grade', 'QualificationStatus'];

async function makeXlsx(rows: string[][]): Promise<Buffer> {
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
		getGradeTypes: jest.fn().mockResolvedValue([]),
		getQualificationStatusTypes: jest.fn().mockResolvedValue([]),
	};
	return { repository, calls };
}

describe('GradesRcUploadService — positional parsing', () => {
	it('sends structured rows', async () => {
		const { repository, calls } = makeRepository([
			{ row_number: null, error_code: null, upload_log_id: 42 },
		]);
		const service = new GradesRcUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['SEC-001', 'STU-001', 'TG205-T002', '40', '15.5', 'TG404-T001'],
		]);
		const result = await service.processUpload(buffer, 'grades-rc.xlsx', 7, 1, {} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			sectionCode: 'SEC-001',
			studentCode: 'STU-001',
			gradeTypeCode: 'TG205-T002',
			gradeTypePercentage: '40',
			grade: '15.5',
			qualificationStatusCode: 'TG404-T001',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository([
			{ row_number: 2, error_code: 'studentNotFound', upload_log_id: null },
		]);
		const service = new GradesRcUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['SEC-001', 'GHOST', 'TG205-T002', '40', '15.5']]);
		const result = await service.processUpload(buffer, 'grades-rc.xlsx', 1, 1, {
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});

	// The designated-grade-type rule lives in audit.fn_upload_grades_rc, so what is asserted here is
	// the half that is in TypeScript: its two codes reach the user as text instead of as a raw code.
	it.each([
		['gradeTypeNotDesignated', 'no es el designado para el curso'],
		['courseGradeTypeNotDesignated', 'no tiene un tipo de nota designado'],
	])('renders the %s error as localized text', async (errorCode, expectedText) => {
		const { repository } = makeRepository([
			{ row_number: 2, error_code: errorCode, upload_log_id: null },
		]);
		const service = new GradesRcUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['SEC-001', 'STU-001', 'TG205-T003', '40', '15.5', 'TG404-T001'],
		]);
		const result = await service.processUpload(buffer, 'grades-rc.xlsx', 1, 1, {
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		const annotated = new ExcelJS.Workbook();
		await annotated.xlsx.load(Buffer.from(result.excelWithErrors!, 'base64') as any);
		const message = annotated.worksheets[0].getRow(2).getCell(7).value as string;
		expect(message).toContain(expectedText);
	});
});

describe('GradesRcUploadService — template', () => {
	it('builds a Template sheet and an instructions sheet with TG205 and TG404 codes', async () => {
		const repository: any = {
			getGradeTypes: jest.fn().mockResolvedValue([
				{ code: 'TG205-T002', name: 'EB1' },
				{ code: 'TG205-T003', name: 'PA' },
			]),
			getQualificationStatusTypes: jest.fn().mockResolvedValue([
				{ code: 'TG404-T001', name: 'ASISTIO' },
				{ code: 'TG404-T004', name: 'DPI' },
			]),
		};
		const service = new GradesRcUploadService(repository, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaNotasRC.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Código de sección');
		expect(header).toContain('Nota');
		expect(header).toContain('Código de estado de calificación');

		const instructions = wb.getWorksheet('Instrucciones de llenado')!;
		const codes = (instructions.getColumn(1).values as string[]).filter(Boolean);
		expect(codes).toContain('TG205-T002');
		expect(codes).toContain('TG205-T003');
		expect(codes).toContain('TG404-T001');
		expect(codes).toContain('TG404-T004');
	});
});
