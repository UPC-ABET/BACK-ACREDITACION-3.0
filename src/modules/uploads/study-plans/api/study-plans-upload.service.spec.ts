jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock(
	'../core/study-plans-upload.repository',
	() => ({ StudyPlansUploadRepository: class {} }),
	{ virtual: true },
);
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});

import * as ExcelJS from 'exceljs';
import { StudyPlansUploadService } from './study-plans-upload.service';

const uploadLogServiceStub: any = {
	assertRollbackable: jest.fn(),
	assertAcademicPeriodExists: jest.fn(),
};

// Positional layout for languages = ['es','en']:
// studyPlanCode | name_es | name_en | programCode | level | courseCode |
// courseName_es | courseName_en | learningOutcome_es | learningOutcome_en | elective
const HEADER = [
	'Code',
	'Name (ES)',
	'Name (EN)',
	'Program',
	'Level',
	'Course',
	'Course Name (ES)',
	'Course Name (EN)',
	'Outcome (ES)',
	'Outcome (EN)',
	'Elective',
];

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
		getLevelTypes: jest.fn().mockResolvedValue([]),
	};
	return { repository, calls };
}

describe('StudyPlansUploadService — positional parsing', () => {
	it('assembles per-language jsonb from positional columns and sends structured rows', async () => {
		const { repository, calls } = makeRepository(
			['es', 'en'],
			[{ row_number: null, error_code: null, upload_log_id: 42 }],
		);
		const service = new StudyPlansUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			[
				'MALLA-2024',
				'Malla ES',
				'Plan EN',
				'INF',
				'0',
				'CS101',
				'Algoritmos',
				'Algorithms',
				'Resultado',
				'Outcome',
				'SI',
			],
		]);
		const result = await service.processUpload(buffer, 'malla.xlsx', 7, 1, {} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			studyPlanCode: 'MALLA-2024',
			studyPlanName: { es: 'Malla ES', en: 'Plan EN' },
			programCode: 'INF',
			level: '0',
			courseCode: 'CS101',
			courseName: { es: 'Algoritmos', en: 'Algorithms' },
			learningOutcome: { es: 'Resultado', en: 'Outcome' },
			isElective: true,
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('empty elective cell → isElective false', async () => {
		const { repository, calls } = makeRepository(
			['es', 'en'],
			[{ row_number: null, error_code: null, upload_log_id: 1 }],
		);
		const service = new StudyPlansUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['M1', 'a', 'b', 'INF', '0', 'C1', 'c', 'd', 'e', 'f', 'NO'],
		]);
		await service.processUpload(buffer, 'f.xlsx', 1, 1, {} as any);

		expect(calls.uploadArgs![0][0].isElective).toBe(false);
	});

	it('returns annotated excel when the function reports row errors', async () => {
		const { repository } = makeRepository(
			['es', 'en'],
			[{ row_number: 2, error_code: 'programNotFound', upload_log_id: null }],
		);
		const service = new StudyPlansUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([
			['M1', 'a', 'b', 'NOPE', '0', 'C1', 'c', 'd', 'e', 'f', 'SI'],
		]);
		const result = await service.processUpload(buffer, 'f.xlsx', 1, 1, {} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('StudyPlansUploadService — template', () => {
	function makeTemplateRepository(langs: string[]) {
		return {
			getSupportedLanguages: jest.fn().mockResolvedValue(langs),
		} as any;
	}

	it('builds a single Template sheet with no legend sheet', async () => {
		const repository = makeTemplateRepository(['es', 'en']);
		const service = new StudyPlansUploadService(repository, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaMallaCurricular.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Nombre de curso (Español)');
		expect(header).toContain('Nombre de curso (Inglés)');
		expect(header).toContain('Nivel');

		expect(wb.worksheets).toHaveLength(1);
		expect(wb.getWorksheet('Leyenda')).toBeUndefined();
	});

	it('falls back to the default language for an unknown lang', async () => {
		const service = new StudyPlansUploadService(
			makeTemplateRepository(['es', 'en']),
			uploadLogServiceStub,
		);
		const { fileName } = await service.generateTemplate('zz');
		expect(fileName).toBe('PlantillaMallaCurricular.xlsx');
	});
});
