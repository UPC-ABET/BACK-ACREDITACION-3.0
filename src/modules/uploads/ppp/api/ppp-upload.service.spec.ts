jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { PppUploadService } from './ppp-upload.service';

const HEADER = [
	'SurveyType', 'SurveyStatus', 'CodigoAlumno', 'PeriodoCode', 'CampusCode', 'ProgramCode',
	'NroEncuesta', 'RazonSocial', 'NombreJefe', 'CargoJefe', 'TelefonoJefe', 'CorreoJefe',
	'RUC', 'TotalHoras', 'NumeroInforme', 'FechaInicio', 'FechaFin', 'Comentario',
	'OutcomeCode', 'Score',
];

async function makeXlsx(rows: string[][]): Promise<Buffer> {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Sheet1');
	ws.addRow(HEADER);
	rows.forEach((r) => ws.addRow(r));
	const buf = await wb.xlsx.writeBuffer();
	return Buffer.from(buf);
}

function makeQueryRunner(queryImpl: (sql: string, params?: any[]) => Promise<any>) {
	return {
		connect: jest.fn().mockResolvedValue(undefined),
		startTransaction: jest.fn().mockResolvedValue(undefined),
		commitTransaction: jest.fn().mockResolvedValue(undefined),
		rollbackTransaction: jest.fn().mockResolvedValue(undefined),
		release: jest.fn().mockResolvedValue(undefined),
		manager: { query: jest.fn(queryImpl) },
	};
}

const happyQuery = (sql: string, params?: any[]) => {
	if (sql.includes('core.types') && params?.[0] === 'SURVEY_TYPE') return Promise.resolve([{ id: 1, code: 'PPP' }]);
	if (sql.includes('core.types') && params?.[0] === 'SURVEY_STATUS') {
		return Promise.resolve([{ id: 10, code: 'SURVEY_ACTIVE' }, { id: 11, code: 'SURVEY_INACTIVE' }]);
	}
	if (sql.includes('FROM academic.students')) return Promise.resolve([{ id: 100, code: 'U001' }]);
	if (sql.includes('FROM academic.academic_periods')) return Promise.resolve([{ id: 200, code: '2024-1' }]);
	if (sql.includes('FROM organization.campuses')) return Promise.resolve([{ id: 30, code: 'LIMA' }]);
	if (sql.includes('FROM academic.programs')) return Promise.resolve([{ id: 5, code: 'INF' }]);
	if (sql.includes('FROM accreditation.outcomes')) {
		return Promise.resolve([{ id: 700, outcome_code: '1', program_code: 'INF' }]);
	}
	if (sql.includes('INSERT INTO evidence.surveys')) return Promise.resolve([{ id: 5000 }]);
	if (sql.includes('INSERT INTO survey.scores')) return Promise.resolve([]);
	return Promise.resolve([]);
};

describe('PppUploadService (orquestación — POST /excel/upload-PPP)', () => {
	describe('processUpload — camino feliz', () => {
		it('inserta survey + score y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new PppUploadService(dataSource, uploadLogService);

			const row = ['PPP', 'ACT', 'U001', '2024-1', 'LIMA', 'INF', '42', 'EMP', 'J', 'C', '999', 'j@x', '20', '480', '1', '2024-01-01', '2024-06-30', '-', '1', '3.5'];
			const buffer = await makeXlsx([row]);
			const result = await service.processUpload(buffer, 'ppp.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO evidence.surveys'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO survey.scores'))).toBe(true);
		});
	});

	describe('processUpload — con errores', () => {
		it('outcome no encontrado → Excel anotado, sin INSERT', async () => {
			const qr = makeQueryRunner((sql: string, params?: any[]) => {
				if (sql.includes('core.types') && params?.[0] === 'SURVEY_TYPE') return Promise.resolve([{ id: 1, code: 'PPP' }]);
				if (sql.includes('core.types') && params?.[0] === 'SURVEY_STATUS') {
					return Promise.resolve([{ id: 10, code: 'SURVEY_ACTIVE' }]);
				}
				if (sql.includes('FROM academic.students')) return Promise.resolve([{ id: 100, code: 'U001' }]);
				if (sql.includes('FROM academic.academic_periods')) return Promise.resolve([{ id: 200, code: '2024-1' }]);
				if (sql.includes('FROM organization.campuses')) return Promise.resolve([{ id: 30, code: 'LIMA' }]);
				if (sql.includes('FROM academic.programs')) return Promise.resolve([{ id: 5, code: 'INF' }]);
				return Promise.resolve([]); // outcomes vacío
			});
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new PppUploadService(dataSource, uploadLogService);

			const row = ['PPP', 'ACT', 'U001', '2024-1', 'LIMA', 'INF', '42', 'EMP', 'J', 'C', '999', 'j@x', '20', '480', '1', '2024-01-01', '2024-06-30', '-', 'ZZZ', '3.5'];
			const buffer = await makeXlsx([row]);
			const result = await service.processUpload(buffer, 'ppp.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(uploadLogService.start).not.toHaveBeenCalled();
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO'))).toBe(false);
		});
	});

	describe('rollback', () => {
		it('borra scores + surveys por extra.survey_upload_log_id', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new PppUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			const calls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(calls[0]).toContain('DELETE FROM survey.scores');
			expect(calls[0]).toContain('survey_upload_log_id');
			expect(calls[1]).toContain('DELETE FROM evidence.surveys');
		});
	});
});
