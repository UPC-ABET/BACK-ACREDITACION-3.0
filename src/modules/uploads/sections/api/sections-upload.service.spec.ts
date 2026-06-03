jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('../core/sections-upload.repository', () => ({ SectionsUploadRepository: class {} }), {
	virtual: true,
});
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});

import * as ExcelJS from 'exceljs';
import { SectionsUploadService } from './sections-upload.service';

const uploadLogServiceStub: any = {
	assertRollbackable: jest.fn(),
	assertAcademicPeriodExists: jest.fn(),
};

const HEADER = ['Course', 'Section', 'Professor', 'Campus', 'Modality'];

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

describe('SectionsUploadService — positional parsing', () => {
	it('sends structured section rows', async () => {
		const { repository, calls } = makeRepository([
			{ row_number: null, error_code: null, upload_log_id: 42 },
		]);
		const service = new SectionsUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['CS101', 'SEC-A', 'DOC-001', 'CAMP-1', 'P']]);
		const result = await service.processUpload(buffer, 'sections.xlsx', 7, 1, {} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			courseCode: 'CS101',
			sectionCode: 'SEC-A',
			professorCode: 'DOC-001',
			campusCode: 'CAMP-1',
			sectionModalityTypeCode: 'P',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository([
			{ row_number: 2, error_code: 'professorNotFound', upload_log_id: null },
		]);
		const service = new SectionsUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['CS101', 'SEC-A', 'GHOST', 'CAMP-1', 'P']]);
		const result = await service.processUpload(buffer, 'sections.xlsx', 1, 1, {
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('SectionsUploadService — template', () => {
	it('builds a single Template sheet with the localized headers and no legend', async () => {
		const repository: any = {};
		const service = new SectionsUploadService(repository, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaSecciones.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		expect(wb.worksheets).toHaveLength(1);

		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Código del curso');
		expect(header).toContain('Código de sección');
		expect(header).toContain('Código de modalidad de sección');
	});
});
