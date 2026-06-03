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
	HttpStatus: { CONFLICT: 409, BAD_REQUEST: 400 },
}));
jest.mock('../core/charts-upload.repository', () => ({ ChartsUploadRepository: class {} }), {
	virtual: true,
});
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});
jest.mock(
	'../../upload-logs/config/strings/upload-logs.validation',
	() => ({
		uploadLogsValidationStrings: {
			error: {
				chartsAlreadyLoadedForPeriod: 'error.uploads.chartsAlreadyLoadedForPeriod',
				schoolChartNotConfigured: 'error.uploads.schoolChartNotConfigured',
			},
		},
	}),
	{ virtual: true },
);

import * as ExcelJS from 'exceljs';
import { ChartsUploadService } from './charts-upload.service';

const SCHOOL_ID = 9;

const uploadLogServiceStub: any = {
	assertRollbackable: jest.fn(),
	assertAcademicPeriodExists: jest.fn(),
};

// Positional layout for languages = ['es','en']:
// code | parentCode | title_es | title_en | email | entityType (name) | entityCode
const HEADER = ['Code', 'Parent', 'Title ES', 'Title EN', 'Email', 'EntityType', 'EntityCode'];

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
		schoolChartExists: jest.fn().mockResolvedValue(true),
		chartsLoadedForSchoolPeriod: jest.fn().mockResolvedValue(loaded),
		callUploadFunction: jest.fn((...args: any[]) => {
			calls.uploadArgs = args;
			return Promise.resolve(uploadFnResult);
		}),
		callRollbackFunction: jest.fn().mockResolvedValue(undefined),
		getEntityTypes: jest.fn().mockResolvedValue([]),
	};
	return { repository, calls };
}

describe('ChartsUploadService — positional parsing', () => {
	it('assembles per-language title jsonb and tree columns into structured rows', async () => {
		const { repository, calls } = makeRepository(
			['es', 'en'],
			[{ row_number: null, error_code: null, upload_log_id: 42 }],
		);
		const service = new ChartsUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['PC1', '', 'Coordinacion CS', 'CS Coordination', 'pc@uni.edu', 'Carrera', 'CS'],
			['A1', 'PC1', 'Area Datos', 'Data Area', 'area@uni.edu', 'Area', ''],
		]);
		const result = await service.processUpload(buffer, 'chart.xlsx', 7, SCHOOL_ID, {
			academicPeriodId: 1,
		} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, schoolId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			code: 'PC1',
			parentCode: '',
			title: { es: 'Coordinacion CS', en: 'CS Coordination' },
			email: 'pc@uni.edu',
			entityType: 'Carrera',
			entityCode: 'CS',
		});
		expect(rows[1]).toMatchObject({
			code: 'A1',
			parentCode: 'PC1',
			entityType: 'Area',
			entityCode: '',
		});
		expect(academicPeriodId).toBe(1);
		expect(schoolId).toBe(SCHOOL_ID);
		expect(userId).toBe(7);
	});

	it('throws when the school already has an uploaded chart for the period', async () => {
		const { repository } = makeRepository(['es', 'en'], [], true);
		const service = new ChartsUploadService(repository, uploadLogServiceStub);
		const buffer = await makeXlsx([['PC1', '', 'a', 'b', 'x@uni.edu', 'Carrera', 'CS']]);
		await expect(
			service.processUpload(buffer, 'c.xlsx', 1, SCHOOL_ID, { academicPeriodId: 1 } as any),
		).rejects.toThrow();
	});

	it('throws when the school chart node is not configured', async () => {
		const { repository } = makeRepository(['es', 'en'], []);
		repository.schoolChartExists.mockResolvedValueOnce(false);
		const service = new ChartsUploadService(repository, uploadLogServiceStub);
		const buffer = await makeXlsx([['PC1', '', 'a', 'b', 'x@uni.edu', 'Carrera', 'CS']]);
		await expect(
			service.processUpload(buffer, 'c.xlsx', 1, SCHOOL_ID, { academicPeriodId: 1 } as any),
		).rejects.toThrow();
	});

	it('returns annotated excel when the function reports row errors', async () => {
		const { repository } = makeRepository(
			['es', 'en'],
			[{ row_number: 2, error_code: 'staffNotFound', upload_log_id: null }],
		);
		const service = new ChartsUploadService(repository, uploadLogServiceStub);
		const buffer = await makeXlsx([['PC1', '', 'a', 'b', 'ghost@uni.edu', 'Carrera', 'CS']]);
		const result = await service.processUpload(buffer, 'c.xlsx', 1, SCHOOL_ID, {
			academicPeriodId: 1,
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('ChartsUploadService — template', () => {
	function makeTemplateRepository(langs: string[]) {
		return {
			getSupportedLanguages: jest.fn().mockResolvedValue(langs),
			getEntityTypes: jest.fn().mockResolvedValue([
				{ code: 'TG903-T003', name: 'Carrera' },
				{ code: 'TG903-T004', name: 'Area' },
				{ code: 'TG903-T005', name: 'Subarea' },
				{ code: 'TG903-T006', name: 'Curso' },
			]),
		} as any;
	}

	it('builds a single Template sheet with the entity-type column and no legend sheet', async () => {
		const service = new ChartsUploadService(
			makeTemplateRepository(['es', 'en']),
			uploadLogServiceStub,
		);
		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaOrganigrama.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Unidad académica (Español)');
		expect(header).toContain('Tipo de entidad');

		expect(wb.worksheets).toHaveLength(1);
		expect(wb.getWorksheet('Tipos de entidad')).toBeUndefined();
		expect(wb.getWorksheet('Niveles')).toBeUndefined();

		// the dropdown must sit on the entity-type column (code, parentCode, title×2, email, entityType),
		// not on the "Correo del responsable" (email) column
		const sheet = wb.getWorksheet('Template')!;
		const entityTypeCol = 2 + 2 + 2; // SINGLE_COLUMNS_BEFORE_TITLE + langs(2) + 2
		const emailCol = entityTypeCol - 1;
		expect(sheet.getCell(2, entityTypeCol).dataValidation?.type).toBe('list');
		expect(sheet.getCell(2, emailCol).dataValidation).toBeUndefined();
	});
});
