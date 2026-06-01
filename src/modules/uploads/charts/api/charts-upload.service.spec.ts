jest.mock('@nestjs/common', () => ({
	Injectable: () => () => undefined,
	HttpException: class HttpException extends Error {
		constructor(
			public response: unknown,
			public status: number,
		) {
			super(typeof response === 'string' ? response : JSON.stringify(response));
		}
	},
	HttpStatus: { CONFLICT: 409 },
}));
jest.mock('../core/charts-upload.repository', () => ({ ChartsUploadRepository: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });
jest.mock('../../upload-logs/config/strings/upload-logs.validation', () => ({
	uploadLogsValidationStrings: { error: { chartsAlreadyLoadedForPeriod: 'error.uploads.chartsAlreadyLoadedForPeriod' } },
}), { virtual: true });

import * as ExcelJS from 'exceljs';
import { ChartsUploadService } from './charts-upload.service';

const uploadLogServiceStub: any = { assertRollbackable: jest.fn(), assertAcademicPeriodExists: jest.fn() };

// Positional layout for languages = ['es','en']:
// code | parentCode | levelTypeCode | title_es | title_en | email | entityTypeCode | entityCode
const HEADER = ['Code', 'Parent', 'Level', 'Title ES', 'Title EN', 'Email', 'EntityType', 'EntityCode'];

async function makeXlsx(rows: string[][]): Promise<Buffer> {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Sheet1');
	ws.addRow(HEADER);
	rows.forEach((r) => ws.addRow(r));
	const buf = await wb.xlsx.writeBuffer();
	return Buffer.from(buf);
}

function makeRepository(langs: string[], uploadFnResult: any[], loaded = false) {
	const calls: { uploadArgs?: any[] } = {};
	const repository: any = {
		getSupportedLanguages: jest.fn().mockResolvedValue(langs),
		chartsLoadedForPeriod: jest.fn().mockResolvedValue(loaded),
		callUploadFunction: jest.fn((...args: any[]) => {
			calls.uploadArgs = args;
			return Promise.resolve(uploadFnResult);
		}),
		callRollbackFunction: jest.fn().mockResolvedValue(undefined),
		getLevelTypes: jest.fn().mockResolvedValue([]),
		getEntityTypes: jest.fn().mockResolvedValue([]),
	};
	return { repository, calls };
}

describe('ChartsUploadService — positional parsing', () => {
	it('assembles per-language title jsonb and tree columns into structured rows', async () => {
		const { repository, calls } = makeRepository(['es', 'en'], [{ row_number: null, error_code: null, upload_log_id: 42 }]);
		const service = new ChartsUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['1', '', 'TG902-T001', 'Decanato', 'Dean', 'dean@uni.edu', '', ''],
			['2', '1', 'TG902-T002', 'Direccion', 'Direction', 'dir@uni.edu', 'TG903-T001', 'EISCB'],
		]);
		const result = await service.processUpload(buffer, 'chart.xlsx', 7, { academicPeriodId: 1 } as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			code: '1',
			parentCode: '',
			levelTypeCode: 'TG902-T001',
			title: { es: 'Decanato', en: 'Dean' },
			email: 'dean@uni.edu',
			entityTypeCode: '',
			entityCode: '',
		});
		expect(rows[1]).toMatchObject({
			code: '2',
			parentCode: '1',
			entityTypeCode: 'TG903-T001',
			entityCode: 'EISCB',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('throws when the period already has an uploaded chart', async () => {
		const { repository } = makeRepository(['es', 'en'], [], true);
		const service = new ChartsUploadService(repository, uploadLogServiceStub);
		const buffer = await makeXlsx([['1', '', 'TG902-T001', 'a', 'b', 'x@uni.edu', '', '']]);
		await expect(service.processUpload(buffer, 'c.xlsx', 1, { academicPeriodId: 1 } as any)).rejects.toThrow();
	});

	it('returns annotated excel when the function reports row errors', async () => {
		const { repository } = makeRepository(['es', 'en'], [
			{ row_number: 2, error_code: 'staffNotFound', upload_log_id: null },
		]);
		const service = new ChartsUploadService(repository, uploadLogServiceStub);
		const buffer = await makeXlsx([['1', '', 'TG902-T001', 'a', 'b', 'ghost@uni.edu', '', '']]);
		const result = await service.processUpload(buffer, 'c.xlsx', 1, { academicPeriodId: 1, lang: 'es' } as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('ChartsUploadService — template', () => {
	function makeTemplateRepository(langs: string[]) {
		return {
			getSupportedLanguages: jest.fn().mockResolvedValue(langs),
			getLevelTypes: jest.fn().mockResolvedValue([{ code: 'TG902-T001', name: 'Decanato' }]),
			getEntityTypes: jest.fn().mockResolvedValue([{ code: 'TG903-T001', name: 'Escuela' }]),
		} as any;
	}

	it('builds Template + two legend sheets (levels, entity types)', async () => {
		const service = new ChartsUploadService(makeTemplateRepository(['es', 'en']), uploadLogServiceStub);
		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaOrganigrama.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Título (Español)');
		expect(header).toContain('Título (Inglés)');

		const levelCodes = (wb.getWorksheet('Niveles')!.getColumn(1).values as string[]).filter(Boolean);
		expect(levelCodes).toContain('TG902-T001');
		const entityCodes = (wb.getWorksheet('Tipos de entidad')!.getColumn(1).values as string[]).filter(Boolean);
		expect(entityCodes).toContain('TG903-T001');
	});
});
