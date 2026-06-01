jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('../core/outcomes-upload.repository', () => ({ OutcomesUploadRepository: class {} }), {
	virtual: true,
});
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), {
	virtual: true,
});

import * as ExcelJS from 'exceljs';
import { OutcomesUploadService } from './outcomes-upload.service';

const uploadLogServiceStub: any = {
	assertRollbackable: jest.fn(),
	assertAcademicPeriodExists: jest.fn(),
};

const HEADER = ['Outcome', 'Name (ES)', 'Name (EN)', 'Program', 'Commission'];

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
	};
	return { repository, calls };
}

describe('OutcomesUploadService — positional parsing', () => {
	it('assembles per-language outcomeName jsonb and sends structured rows', async () => {
		const { repository, calls } = makeRepository(
			['es', 'en'],
			[{ row_number: null, error_code: null, upload_log_id: 42 }],
		);
		const service = new OutcomesUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['SO1', 'Resultado uno', 'Outcome one', 'INF', 'EAC']]);
		const result = await service.processUpload(buffer, 'outcomes.xlsx', 7, {
			academicPeriodId: 1,
		} as any);

		expect(result.success).toBe(true);
		expect(result.uploadLogId).toBe(42);

		const [rows, academicPeriodId, userId] = calls.uploadArgs!;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			outcomeCode: 'SO1',
			outcomeName: { es: 'Resultado uno', en: 'Outcome one' },
			programCode: 'INF',
			commissionCode: 'EAC',
		});
		expect(academicPeriodId).toBe(1);
		expect(userId).toBe(7);
	});

	it('returns annotated excel with localized text when the function reports row errors', async () => {
		const { repository } = makeRepository(
			['es', 'en'],
			[{ row_number: 2, error_code: 'programCommissionNotFound', upload_log_id: null }],
		);
		const service = new OutcomesUploadService(repository, uploadLogServiceStub);

		const buffer = await makeXlsx([['SO1', 'Resultado uno', 'Outcome one', 'INF', 'GHOST']]);
		const result = await service.processUpload(buffer, 'outcomes.xlsx', 1, {
			academicPeriodId: 1,
			lang: 'es',
		} as any);

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(result.excelWithErrors).toBeTruthy();
	});
});

describe('OutcomesUploadService — template', () => {
	it('builds a Template sheet with localized bilingual name headers', async () => {
		const repository: any = { getSupportedLanguages: jest.fn().mockResolvedValue(['es', 'en']) };
		const service = new OutcomesUploadService(repository, uploadLogServiceStub);

		const { buffer, fileName } = await service.generateTemplate('es');
		expect(fileName).toBe('PlantillaOutcomes.xlsx');

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buffer as any);
		const header = wb.getWorksheet('Template')!.getRow(1).values as string[];
		expect(header).toContain('Nombre del outcome (Español)');
		expect(header).toContain('Nombre del outcome (Inglés)');
		expect(header).toContain('Código del programa');
		expect(header).toContain('Código de la comisión');
	});
});
