jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { OutcomesUploadService } from './outcomes-upload.service';

const HEADER = ['Acreditadora', 'Comision', 'Carrera', 'CodigoMalla', 'CodigoCurso', 'OutcomeCode', 'OutcomeNameEn', 'OutcomeDescription', 'OutcomeType'];

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

const happyQuery = (sql: string) => {
	if (sql.includes('FROM academic.programs')) return Promise.resolve([{ id: 5, code: 'INF' }]);
	if (sql.includes('FROM academic.study_plan_courses')) {
		return Promise.resolve([{ id: 100, plan_code: 'MALLA-2024', course_code: 'CS101' }]);
	}
	if (sql.includes('core.types')) return Promise.resolve([{ id: 1, code: 'CONTROL' }]);
	if (sql.includes('FROM academic.course_outcome_mappings')) return Promise.resolve([]);
	if (sql.includes('FROM accreditation.accreditors')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO accreditation.accreditors')) return Promise.resolve([{ id: 1000 }]);
	if (sql.includes('FROM accreditation.commissions')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO accreditation.commissions')) return Promise.resolve([{ id: 1100 }]);
	if (sql.includes('FROM accreditation.program_commissions')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO accreditation.program_commissions')) return Promise.resolve([{ id: 1200 }]);
	if (sql.includes('FROM accreditation.outcomes')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO accreditation.outcomes')) return Promise.resolve([{ id: 1300 }]);
	if (sql.includes('INSERT INTO academic.course_outcome_mappings')) return Promise.resolve([]);
	return Promise.resolve([]);
};

describe('OutcomesUploadService (orquestación)', () => {
	describe('processUpload — camino feliz', () => {
		it('inserta catálogo + outcome + mapping y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new OutcomesUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['ABET', 'EAC', 'INF', 'MALLA-2024', 'CS101', '1', 'EK', 'Conoc Ing', 'CONTROL']]);
			const result = await service.processUpload(buffer, 'outcomes.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO accreditation.outcomes'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.course_outcome_mappings'))).toBe(true);
		});
	});

	describe('processUpload — con errores', () => {
		it('carrera no existe → Excel anotado, sin INSERT', async () => {
			const qr = makeQueryRunner((sql: string) => {
				if (sql.includes('core.types')) return Promise.resolve([{ id: 1, code: 'CONTROL' }]);
				return Promise.resolve([]);
			});
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new OutcomesUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['ABET', 'EAC', 'NOPE', 'MALLA-2024', 'CS101', '1', 'EK', 'X', 'CONTROL']]);
			const result = await service.processUpload(buffer, 'outcomes.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(uploadLogService.start).not.toHaveBeenCalled();
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO accreditation.outcomes'))).toBe(false);
		});
	});

	describe('rollback', () => {
		it('borra course_outcome_mappings + outcomes y marca log', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new OutcomesUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			const calls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(calls[0]).toContain('DELETE FROM academic.course_outcome_mappings');
			expect(calls[1]).toContain('DELETE FROM accreditation.outcomes');
		});
	});
});
