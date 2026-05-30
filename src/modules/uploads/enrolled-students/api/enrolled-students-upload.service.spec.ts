jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { EnrolledStudentsUploadService } from './enrolled-students-upload.service';

const HEADER = ['CodigoAlumno', 'NombreCompleto', 'Carrera', 'EstadoMatricula', 'Sede'];

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
	if (sql.includes('INSERT INTO organization.users')) return Promise.resolve([{ id: 1000 }]);
	if (sql.includes('INSERT INTO academic.students')) return Promise.resolve([{ id: 900 }]);
	if (sql.includes('INSERT INTO academic.enrolled_students')) return Promise.resolve([]);
	if (sql.includes('JOIN academic.enrolled_students es')) return Promise.resolve([]); // dedup vacío
	if (sql.includes('FROM academic.study_plan_academic_periods')) return Promise.resolve([{ id: 200 }]);
	if (sql.includes('FROM academic.programs')) return Promise.resolve([{ id: 5, code: 'INF' }]);
	if (sql.includes('FROM organization.campuses')) return Promise.resolve([{ id: 30, code: 'LIMA' }]);
	if (sql.includes('core.types')) return Promise.resolve([{ id: 7, code: 'MATRICULADO' }]);
	return Promise.resolve([]);
};

describe('EnrolledStudentsUploadService (orquestación — réplica de USP_AlumnoMatriculadoCargaMasiva)', () => {
	describe('processUpload — camino feliz', () => {
		it('inserta users+students+enrolled_students, registra log y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new EnrolledStudentsUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['U001', 'PEREZ, JUAN', 'INF', 'MATRICULADO', 'LIMA']]);
			const result = await service.processUpload(buffer, 'alumnos.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			expect(result.loadedRows).toBe(1);
			expect(result.uploadLogId).toBe(42);
			expect(uploadLogService.start).toHaveBeenCalledTimes(1);
			expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
			expect(qr.rollbackTransaction).not.toHaveBeenCalled();

			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO organization.users'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.students'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.enrolled_students'))).toBe(true);
		});
	});

	describe('processUpload — con errores (ALL-OR-NOTHING)', () => {
		it('no inserta nada y devuelve el Excel anotado', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([])); // todos los lookups vacíos → la fila falla
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new EnrolledStudentsUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['U001', 'PEREZ, JUAN', 'INF', 'MATRICULADO', 'LIMA']]);
			const result = await service.processUpload(buffer, 'alumnos.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(result.errorRows).toBe(1);
			expect(result.uploadLogId).toBeNull();
			expect(typeof result.excelWithErrors).toBe('string');
			expect(uploadLogService.start).not.toHaveBeenCalled();
			expect(qr.startTransaction).not.toHaveBeenCalled();
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO'))).toBe(false);
			expect(qr.release).toHaveBeenCalledTimes(1);
		});
	});

	describe('rollback', () => {
		it('borra enrolled_students + students por upload_log_id y marca el log', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new EnrolledStudentsUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('DELETE FROM academic.enrolled_students'))).toBe(true);
			expect(sqls.some((s) => s.includes('DELETE FROM academic.students'))).toBe(true);
			expect(uploadLogService.markRolledBack).toHaveBeenCalledWith(42, qr.manager);
			expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
		});
	});
});
