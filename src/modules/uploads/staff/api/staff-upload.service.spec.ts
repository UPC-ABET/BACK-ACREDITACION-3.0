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

const HEADER = ['Email', 'Position', 'Job (ES)', 'Job (EN)', 'Professor'];

async function makeXlsx(rows: string[][]): Promise<Buffer> {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Sheet1');
	ws.addRow(HEADER);
	rows.forEach((r) => ws.addRow(r));
	const buf = await wb.xlsx.writeBuffer();
	return Buffer.from(buf);
}

function makeRepository(langs: string[], uploadFnResult: any[]) {
	const calls: { uploadArgs?: any[] } = {};
	const repository: any = {
		getSupportedLanguages: jest.fn().mockResolvedValue(langs),
		callUploadFunction: jest.fn((...args: any[]) => {
			calls.uploadArgs = args;
			return Promise.resolve(uploadFnResult);
		}),
		callRollbackFunction: jest.fn().mockResolvedValue(undefined),
		getPositionTypes: jest.fn().mockResolvedValue([]),
	};
	return { repository, calls };
}

describe('StaffUploadService — positional parsing', () => {
	it('assembles per-language jobTitle jsonb and sends structured rows', async () => {
		const { repository, calls } = makeRepository(
			['es', 'en'],
			[{ row_number: null, error_code: null, upload_log_id: 42 }],
		);
		const service = new StaffUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['jane@uni.edu', 'TG901-T003', 'Docente', 'Lecturer', 'DOC-001'],
		]);
		const result = await service.processUpload(buffer, 'staff.xlsx', 7, {
			academicPeriodId: 1,
		} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			email: 'jane@uni.edu',
			positionTypeCode: 'TG901-T003',
			jobTitle: { es: 'Docente', en: 'Lecturer' },
			professorCode: 'DOC-001',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository(
			['es', 'en'],
			[{ row_number: 2, error_code: 'userNotFound', upload_log_id: null }],
		);
		const service = new StaffUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['ghost@uni.edu', 'TG901-T003', 'Docente', 'Lecturer', '']]);
		const result = await service.processUpload(buffer, 'staff.xlsx', 1, {
			academicPeriodId: 1,
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('StaffUploadService — template', () => {
	function makeTemplateRepository(
		langs: string[],
		positions: Array<{ code: string; name: string }>,
	) {
		return {
			getSupportedLanguages: jest.fn().mockResolvedValue(langs),
			getPositionTypes: jest.fn().mockResolvedValue(positions),
		} as any;
	}

	it('builds a Template sheet and a localized Legend sheet with the position codes', async () => {
		const repository = makeTemplateRepository(
			['es', 'en'],
			[
				{ code: 'TG901-T001', name: 'Administrador' },
				{ code: 'TG901-T003', name: 'Profesor' },
			],
		);
		const service = new StaffUploadService(repository, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaPersonal.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Cargo (Español)');
		expect(header).toContain('Cargo (Inglés)');

		const legend = wb.getWorksheet('Leyenda')!;
		const codes = (legend.getColumn(1).values as string[]).filter(Boolean);
		expect(codes).toContain('TG901-T001');
		expect(codes).toContain('TG901-T003');
	});
});
