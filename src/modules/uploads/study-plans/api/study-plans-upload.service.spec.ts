jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { StudyPlansUploadService } from './study-plans-upload.service';

const HEADER = ['CodigoMalla', 'NombreMalla', 'CodigoCarrera', 'CodigoCurso', 'NombreCurso', 'EsElectivo', 'NivelCurso', 'Requisitos'];

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
	if (sql.includes('core.types')) return Promise.resolve([{ id: 1, code: 'BASIC' }]);
	if (sql.includes('FROM academic.courses')) return Promise.resolve([]);
	if (sql.includes('FROM academic.study_plans')) return Promise.resolve([]);
	if (sql.includes('FROM academic.study_plan_courses')) return Promise.resolve([]);
	if (sql.includes('SELECT id FROM academic.study_plan_academic_periods')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO academic.study_plans')) return Promise.resolve([{ id: 200 }]);
	if (sql.includes('INSERT INTO academic.study_plan_academic_periods')) return Promise.resolve([{ id: 201 }]);
	if (sql.includes('INSERT INTO academic.courses')) return Promise.resolve([{ id: 300 }]);
	if (sql.includes('INSERT INTO academic.study_plan_courses')) return Promise.resolve([{ id: 400 }]);
	if (sql.includes('INSERT INTO academic.course_prerequisites')) return Promise.resolve([]);
	return Promise.resolve([]);
};

describe('StudyPlansUploadService (orquestación)', () => {
	describe('processUpload — camino feliz', () => {
		it('inserta plan + spap + course + spc y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new StudyPlansUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['MALLA-2024', 'Malla 2024', 'INF', 'CS101', 'Algoritmos', 'false', 'BASIC', '']]);
			const result = await service.processUpload(buffer, 'malla.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.study_plans'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.courses'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.study_plan_courses'))).toBe(true);
		});
	});

	describe('processUpload — con errores', () => {
		it('carrera no existe → Excel anotado, sin INSERT', async () => {
			const qr = makeQueryRunner((sql: string) => {
				if (sql.includes('core.types')) return Promise.resolve([{ id: 1, code: 'BASIC' }]);
				return Promise.resolve([]);
			});
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new StudyPlansUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['MALLA-2024', 'X', 'NOPE', 'CS101', 'Algo', 'false', 'BASIC', '']]);
			const result = await service.processUpload(buffer, 'malla.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(uploadLogService.start).not.toHaveBeenCalled();
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO'))).toBe(false);
		});
	});

	describe('rollback', () => {
		it('borra prereqs + spc + courses + spap + plans y marca log', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new StudyPlansUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			const calls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(calls[0]).toContain('DELETE FROM academic.course_prerequisites');
			expect(calls[1]).toContain('DELETE FROM academic.study_plan_courses');
			expect(calls[2]).toContain('DELETE FROM academic.courses');
			expect(calls[3]).toContain('DELETE FROM academic.study_plan_academic_periods');
			expect(calls[4]).toContain('DELETE FROM academic.study_plans');
			expect(uploadLogService.markRolledBack).toHaveBeenCalledWith(42, qr.manager);
		});
	});
});
