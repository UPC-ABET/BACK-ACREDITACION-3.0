jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('../core/enrolled-students-upload.repository', () => ({ EnrolledStudentsUploadRepository: class {} }), {
	virtual: true,
});
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});

import * as ExcelJS from 'exceljs';
import { EnrolledStudentsUploadService } from './enrolled-students-upload.service';

const uploadLogServiceStub: any = { assertRollbackable: jest.fn(), assertAcademicPeriodExists: jest.fn() };

const HEADER = ['Student', 'Email', 'Program', 'Plan', 'Campus', 'Modality'];

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
		getEnrollmentModalities: jest.fn().mockResolvedValue([]),
	};
	return { repository, calls };
}

describe('EnrolledStudentsUploadService — positional parsing', () => {
	it('sends structured rows', async () => {
		const { repository, calls } = makeRepository([
			{ row_number: null, error_code: null, upload_log_id: 42 },
		]);
		const service = new EnrolledStudentsUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['STU-001', 'luis@uni.edu', 'INF', 'MALLA-2024', 'CAMP-1', 'TG103-T001'],
		]);
		const result = await service.processUpload(buffer, 'enrolled.xlsx', 7, {
			academicPeriodId: 1,
		} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			studentCode: 'STU-001',
			email: 'luis@uni.edu',
			programCode: 'INF',
			studyPlanCode: 'MALLA-2024',
			campusCode: 'CAMP-1',
			enrollmentModalityTypeCode: 'TG103-T001',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository([
			{ row_number: 2, error_code: 'userNotFound', upload_log_id: null },
		]);
		const service = new EnrolledStudentsUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['STU-001', 'ghost@uni.edu', 'INF', 'MALLA-2024', 'CAMP-1', 'TG103-T001']]);
		const result = await service.processUpload(buffer, 'enrolled.xlsx', 1, {
			academicPeriodId: 1,
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('EnrolledStudentsUploadService — template', () => {
	it('builds a Template sheet and a localized legend sheet with TG103 codes', async () => {
		const repository: any = {
			getEnrollmentModalities: jest.fn().mockResolvedValue([
				{ code: 'TG103-T001', name: 'Presencial' },
				{ code: 'TG103-T002', name: 'Virtual' },
			]),
		};
		const service = new EnrolledStudentsUploadService(repository, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaMatriculados.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Código del alumno');
		expect(header).toContain('Código de modalidad de matrícula');

		const legend = wb.getWorksheet('Modalidades de matrícula')!;
		const codes = (legend.getColumn(1).values as string[]).filter(Boolean);
		expect(codes).toContain('TG103-T001');
		expect(codes).toContain('TG103-T002');
	});
});
