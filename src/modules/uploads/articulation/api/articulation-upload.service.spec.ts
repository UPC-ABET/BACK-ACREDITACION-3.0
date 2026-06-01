jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock(
	'../core/articulation-upload.repository',
	() => ({ ArticulationUploadRepository: class {} }),
	{
		virtual: true,
	},
);
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});

import * as ExcelJS from 'exceljs';
import { ArticulationUploadService } from './articulation-upload.service';

const uploadLogServiceStub: any = {
	assertRollbackable: jest.fn(),
	assertAcademicPeriodExists: jest.fn(),
};

const HEADER = ['Outcome', 'Plan', 'Course', 'Type'];

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
		getOutcomeTypes: jest.fn().mockResolvedValue([]),
	};
	return { repository, calls };
}

describe('ArticulationUploadService — positional parsing', () => {
	it('sends structured rows for the outcome↔course matrix', async () => {
		const { repository, calls } = makeRepository([
			{ row_number: null, error_code: null, upload_log_id: 42 },
		]);
		const service = new ArticulationUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['SO1', 'MALLA-2024', 'CS101', 'TG302-T001']]);
		const result = await service.processUpload(buffer, 'articulation.xlsx', 7, {
			academicPeriodId: 1,
		} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			outcomeCode: 'SO1',
			studyPlanCode: 'MALLA-2024',
			courseCode: 'CS101',
			outcomeTypeCode: 'TG302-T001',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository([
			{ row_number: 2, error_code: 'studyPlanCourseNotFound', upload_log_id: null },
		]);
		const service = new ArticulationUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['SO1', 'MALLA-2024', 'GHOST', 'TG302-T001']]);
		const result = await service.processUpload(buffer, 'articulation.xlsx', 1, {
			academicPeriodId: 1,
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('ArticulationUploadService — template', () => {
	it('builds a Template sheet and a localized legend sheet with TG302 codes', async () => {
		const repository: any = {
			getOutcomeTypes: jest.fn().mockResolvedValue([
				{ code: 'TG302-T001', name: 'Verificación' },
				{ code: 'TG302-T002', name: 'Control' },
			]),
		};
		const service = new ArticulationUploadService(repository, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaArticulacion.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Código del outcome');
		expect(header).toContain('Código del tipo de outcome');

		const legend = wb.getWorksheet('Tipos de outcome')!;
		const codes = (legend.getColumn(1).values as string[]).filter(Boolean);
		expect(codes).toContain('TG302-T001');
		expect(codes).toContain('TG302-T002');
	});
});
