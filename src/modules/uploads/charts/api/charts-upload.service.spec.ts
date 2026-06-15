jest.mock('@nestjs/common', () => ({
	Injectable: () => () => undefined,
	Logger: class {
		error() {}
		warn() {}
		log() {}
	},
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
jest.mock('src/modules/organization/users/api/users.service', () => ({ UserService: class {} }), {
	virtual: true,
});
jest.mock(
	'../../upload-logs/config/strings/upload-logs.validation',
	() => ({
		uploadLogsValidationStrings: {
			error: {
				chartsAlreadyLoadedForPeriod: 'error.uploads.chartsAlreadyLoadedForPeriod',
				schoolChartNotConfigured: 'error.uploads.schoolChartNotConfigured',
				ifcRoleNotConfigured: 'error.uploads.ifcRoleNotConfigured',
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
// code | parentCode | title_es | title_en | professorCode | email | entityType (name) | entityCode
const HEADER = [
	'Code',
	'Parent',
	'Title ES',
	'Title EN',
	'ProfessorCode',
	'Email',
	'EntityType',
	'EntityCode',
];

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
		getActiveRoleIdByCode: jest.fn().mockResolvedValue(77),
		getStaffForProvisioning: jest.fn().mockResolvedValue([]),
		findActiveUserIdByEmail: jest.fn().mockResolvedValue(null),
		linkStaffToUser: jest.fn().mockResolvedValue(undefined),
		assignUserRole: jest.fn().mockResolvedValue(undefined),
	};
	return { repository, calls };
}

const userServiceStub: any = { create: jest.fn().mockResolvedValue({ id: 1 }) };

describe('ChartsUploadService — positional parsing', () => {
	it('assembles per-language title jsonb and tree columns into structured rows', async () => {
		const { repository, calls } = makeRepository(
			['es', 'en'],
			[{ row_number: null, error_code: null, upload_log_id: 42 }],
		);
		const service = new ChartsUploadService(repository, uploadLogServiceStub, userServiceStub);

		const buffer = await makeXlsx([
			['PC1', '', 'Coordinacion CS', 'CS Coordination', 'P001', 'pc@uni.edu', 'Carrera', 'CS'],
			['A1', 'PC1', 'Area Datos', 'Data Area', 'P002', 'area@uni.edu', 'Area', ''],
		]);
		const result = await service.processUpload(buffer, 'chart.xlsx', 7, SCHOOL_ID, 1, {} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, schoolId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			code: 'PC1',
			parentCode: '',
			title: { es: 'Coordinacion CS', en: 'CS Coordination' },
			professorCode: 'P001',
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
		const service = new ChartsUploadService(repository, uploadLogServiceStub, userServiceStub);
		const buffer = await makeXlsx([['PC1', '', 'a', 'b', 'P001', 'pc@uni.edu', 'Carrera', 'CS']]);
		await expect(
			service.processUpload(buffer, 'c.xlsx', 1, SCHOOL_ID, 1, {} as any),
		).rejects.toThrow();
	});

	it('throws when the school chart node is not configured', async () => {
		const { repository } = makeRepository(['es', 'en'], []);
		repository.schoolChartExists.mockResolvedValueOnce(false);
		const service = new ChartsUploadService(repository, uploadLogServiceStub, userServiceStub);
		const buffer = await makeXlsx([['PC1', '', 'a', 'b', 'P001', 'pc@uni.edu', 'Carrera', 'CS']]);
		await expect(
			service.processUpload(buffer, 'c.xlsx', 1, SCHOOL_ID, 1, {} as any),
		).rejects.toThrow();
	});

	it('returns annotated excel when the function reports row errors', async () => {
		const { repository } = makeRepository(
			['es', 'en'],
			[{ row_number: 2, error_code: 'professorNotFound', upload_log_id: null }],
		);
		const service = new ChartsUploadService(repository, uploadLogServiceStub, userServiceStub);
		const buffer = await makeXlsx([
			['PC1', '', 'a', 'b', 'GHOST', 'ghost@uni.edu', 'Carrera', 'CS'],
		]);
		const result = await service.processUpload(buffer, 'c.xlsx', 1, SCHOOL_ID, 1, {
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('ChartsUploadService — IFC role guard & provisioning', () => {
	const okResult = [{ row_number: null, error_code: null, upload_log_id: 9 }];
	const oneRow = () => makeXlsx([['PC1', '', 'a', 'b', 'P001', 'x@u.edu', 'Carrera', 'CS']]);

	beforeEach(() => userServiceStub.create.mockClear());

	it('throws before loading when the IFC role is not configured', async () => {
		const { repository } = makeRepository(['es', 'en'], []);
		repository.getActiveRoleIdByCode.mockResolvedValueOnce(null);
		const service = new ChartsUploadService(repository, uploadLogServiceStub, userServiceStub);
		await expect(
			service.processUpload(await oneRow(), 'c.xlsx', 1, SCHOOL_ID, 1, {} as any),
		).rejects.toThrow();
		expect(repository.callUploadFunction).not.toHaveBeenCalled();
	});

	it('links the staff to an existing user instead of creating one', async () => {
		const { repository } = makeRepository(['es', 'en'], okResult);
		repository.getStaffForProvisioning.mockResolvedValueOnce([
			{ staffId: 5, firstName: 'A', lastName: 'B', email: 'x@u.edu', userId: null },
		]);
		repository.findActiveUserIdByEmail.mockResolvedValueOnce(42);
		const service = new ChartsUploadService(repository, uploadLogServiceStub, userServiceStub);
		const result = await service.processUpload(
			await oneRow(),
			'c.xlsx',
			1,
			SCHOOL_ID,
			1,
			{} as any,
		);
		expect(result.success).toBe(true);
		expect(repository.linkStaffToUser).toHaveBeenCalledWith(5, 42);
		expect(userServiceStub.create).not.toHaveBeenCalled();
	});

	it('creates an IFC user and assigns the role when none exists for the email', async () => {
		const { repository } = makeRepository(['es', 'en'], okResult);
		repository.getStaffForProvisioning.mockResolvedValueOnce([
			{ staffId: 5, firstName: 'A', lastName: 'B', email: 'x@u.edu', userId: null },
		]);
		repository.findActiveUserIdByEmail.mockResolvedValueOnce(null);
		userServiceStub.create.mockResolvedValueOnce({ id: 100 });
		const service = new ChartsUploadService(repository, uploadLogServiceStub, userServiceStub);
		await service.processUpload(await oneRow(), 'c.xlsx', 1, SCHOOL_ID, 1, {} as any);
		expect(userServiceStub.create).toHaveBeenCalledWith(
			expect.objectContaining({ email: 'x@u.edu', firstName: 'A', lastName: 'B', staffId: 5 }),
		);
		expect(repository.assignUserRole).toHaveBeenCalledWith(100, 77);
	});

	it('skips provisioning for staff already linked to a user', async () => {
		const { repository } = makeRepository(['es', 'en'], okResult);
		repository.getStaffForProvisioning.mockResolvedValueOnce([
			{ staffId: 5, firstName: 'A', lastName: 'B', email: 'x@u.edu', userId: 7 },
		]);
		const service = new ChartsUploadService(repository, uploadLogServiceStub, userServiceStub);
		await service.processUpload(await oneRow(), 'c.xlsx', 1, SCHOOL_ID, 1, {} as any);
		expect(userServiceStub.create).not.toHaveBeenCalled();
		expect(repository.linkStaffToUser).not.toHaveBeenCalled();
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

	it('builds a Template sheet plus an entity-type legend with the entity-code rule', async () => {
		const service = new ChartsUploadService(
			makeTemplateRepository(['es', 'en']),
			uploadLogServiceStub,
			userServiceStub,
		);
		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaOrganigrama.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		// first column header is now "Id" (positional parsing, so the rename is cosmetic)
		expect(header[1]).toBe('Id');
		expect(header).toContain('Unidad académica (Español)');
		expect(header).toContain('Tipo de entidad');

		// data sheet + legend sheet
		expect(wb.worksheets).toHaveLength(2);
		const legend = wb.getWorksheet('Tipos de entidad')!;
		expect(legend).toBeDefined();
		const legendHeader = legend.getRow(1).values as string[];
		expect(legendHeader[1]).toBe('Tipo de entidad');
		expect(legendHeader[2]).toBe('¿Requiere código de entidad?');

		// Carrera/Curso require the entity code; Area/Subarea do not
		const usageByType = new Map<string, string>();
		legend.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			usageByType.set(String(row.getCell(1).value), String(row.getCell(2).value));
		});
		expect(usageByType.get('Carrera')).toBe('Sí');
		expect(usageByType.get('Curso')).toBe('Sí');
		expect(usageByType.get('Area')).toBe('No');
		expect(usageByType.get('Subarea')).toBe('No');

		// the dropdown must sit on the entity-type column
		// (code, parentCode, title×2, professorCode, email, entityType), not on the email column
		const sheet = wb.getWorksheet('Template')!;
		const entityTypeCol = 2 + 2 + 3; // SINGLE_COLUMNS_BEFORE_TITLE + langs(2) + 3
		const emailCol = entityTypeCol - 1;
		expect(sheet.getCell(2, entityTypeCol).dataValidation?.type).toBe('list');
		expect(sheet.getCell(2, emailCol).dataValidation).toBeUndefined();
	});
});
