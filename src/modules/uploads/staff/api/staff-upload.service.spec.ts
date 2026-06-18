jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('../core/staff-upload.repository', () => ({ StaffUploadRepository: class {} }), {
	virtual: true,
});
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});

import * as ExcelJS from 'exceljs';
import { StaffUploadService } from './staff-upload.service';

const uploadLogServiceStub: any = {
	assertRollbackable: jest.fn(),
	assertAcademicPeriodExists: jest.fn(),
};

const HEADER = ['Professor', 'Last name', 'First name', 'Email'];

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
	};
	return { repository, calls };
}

describe('StaffUploadService — positional parsing', () => {
	it('sends structured rows with names and professor code', async () => {
		const { repository, calls } = makeRepository([
			{ row_number: null, error_code: null, upload_log_id: 42 },
		]);
		const service = new StaffUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['DOC-001', 'Doe', 'Jane', 'jane.doe@example.com']]);
		const result = await service.processUpload(buffer, 'staff.xlsx', 7, 1, {} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			professorCode: 'DOC-001',
			lastName: 'Doe',
			firstName: 'Jane',
			email: 'jane.doe@example.com',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository([
			{ row_number: 2, error_code: 'lastNameEmpty', upload_log_id: null },
		]);
		const service = new StaffUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['DOC-001', '', 'Jane']]);
		const result = await service.processUpload(buffer, 'staff.xlsx', 1, 1, {
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('StaffUploadService — template', () => {
	it('builds a single Template sheet with the localized headers and no legend', async () => {
		const repository: any = {};
		const service = new StaffUploadService(repository, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaDocentes.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		expect(wb.worksheets).toHaveLength(1);

		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).not.toContain('Correo del usuario');
		expect(header).toContain('Código de docente');
		expect(header).toContain('Apellidos');
		expect(header).toContain('Nombres');
	});
});
