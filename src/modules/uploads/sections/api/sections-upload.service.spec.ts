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

const HEADER = ['Plan', 'Course', 'Campus', 'Professor', 'Modality', 'Section'];

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
		getSectionModalities: jest.fn().mockResolvedValue([]),
	};
	return { repository, calls };
}

describe('SectionsUploadService — positional parsing', () => {
	it('sends structured section rows', async () => {
		const { repository, calls } = makeRepository([
			{ row_number: null, error_code: null, upload_log_id: 42 },
		]);
		const service = new SectionsUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['MALLA-2024', 'CS101', 'CAMP-1', 'DOC-001', 'TG103-T001', 'SEC-A'],
		]);
		const result = await service.processUpload(buffer, 'sections.xlsx', 7, {
			academicPeriodId: 1,
		} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			studyPlanCode: 'MALLA-2024',
			courseCode: 'CS101',
			campusCode: 'CAMP-1',
			professorCode: 'DOC-001',
			sectionModalityTypeCode: 'TG103-T001',
			sectionCode: 'SEC-A',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository([
			{ row_number: 2, error_code: 'professorNotFound', upload_log_id: null },
		]);
		const service = new SectionsUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['MALLA-2024', 'CS101', 'CAMP-1', 'GHOST', 'TG103-T001', 'SEC-A'],
		]);
		const result = await service.processUpload(buffer, 'sections.xlsx', 1, {
			academicPeriodId: 1,
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('SectionsUploadService — template', () => {
	it('builds a Template sheet and a localized legend sheet with TG103 codes', async () => {
		const repository: any = {
			getSectionModalities: jest.fn().mockResolvedValue([
				{ code: 'TG103-T001', name: 'Sección presencial' },
				{ code: 'TG103-T002', name: 'Sección virtual' },
			]),
		};
		const service = new SectionsUploadService(repository, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaSecciones.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Código de sección');
		expect(header).toContain('Código de modalidad de sección');

		const legend = wb.getWorksheet('Modalidades de sección')!;
		const codes = (legend.getColumn(1).values as string[]).filter(Boolean);
		expect(codes).toContain('TG103-T001');
		expect(codes).toContain('TG103-T002');
	});
});
