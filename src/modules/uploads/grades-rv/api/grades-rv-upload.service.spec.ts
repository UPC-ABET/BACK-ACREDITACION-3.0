jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('../core/grades-rv-upload.repository', () => ({ GradesRvUploadRepository: class {} }), {
	virtual: true,
});
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});

import * as ExcelJS from 'exceljs';
import { GradesRvUploadService } from './grades-rv-upload.service';

const uploadLogServiceStub: any = {
	assertRollbackable: jest.fn(),
	assertAcademicPeriodExists: jest.fn(),
};

const HEADER = ['Section', 'Student', 'Outcome', 'Grade'];

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

describe('GradesRvUploadService — positional parsing', () => {
	it('sends structured rows', async () => {
		const { repository, calls } = makeRepository([
			{ row_number: null, error_code: null, upload_log_id: 42 },
		]);
		const service = new GradesRvUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['SEC-001', 'STU-001', 'O-1', '3.5']]);
		const result = await service.processUpload(buffer, 'grades-rv.xlsx', 7, {
			academicPeriodId: 1,
		} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			sectionCode: 'SEC-001',
			studentCode: 'STU-001',
			outcomeCode: 'O-1',
			grade: '3.5',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository([
			{ row_number: 2, error_code: 'outcomeNotFound', upload_log_id: null },
		]);
		const service = new GradesRvUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['SEC-001', 'STU-001', 'GHOST', '3.5']]);
		const result = await service.processUpload(buffer, 'grades-rv.xlsx', 1, {
			academicPeriodId: 1,
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('GradesRvUploadService — template', () => {
	it('builds a single Template sheet with localized headers and no outcome legend', async () => {
		const service = new GradesRvUploadService({} as any, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaNotasRV.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Código de sección');
		expect(header).toContain('Código del outcome');

		expect(wb.worksheets).toHaveLength(1);
		expect(wb.getWorksheet('Outcomes')).toBeUndefined();
	});
});
