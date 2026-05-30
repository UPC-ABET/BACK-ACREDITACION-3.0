// @nestjs/common solo aporta el decorador @Injectable (no-op en runtime de test).
jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { SectionsUploadService } from './sections-upload.service';

const HEADER = ['CodigoCurso', 'Seccion', 'Docente', 'Local', 'TipoEstudio'];

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

// Router de queries para el camino feliz: devuelve lookups válidos + ids de insert.
const happyQuery = (sql: string) => {
	if (sql.includes('FROM academic.courses')) return Promise.resolve([{ id: 10, code: 'CS101' }]);
	if (sql.includes('FROM organization.campuses')) return Promise.resolve([{ id: 30, code: 'LIMA' }]);
	if (sql.includes('FROM academic.professors')) return Promise.resolve([{ id: 20, code: 'PROF1' }]);
	if (sql.includes('FROM academic.study_plan_courses')) return Promise.resolve([{ id: 100, course_id: 10 }]);
	if (sql.includes('core.types')) return Promise.resolve([{ id: 8, code: 'IN_PERSON' }, { id: 9, code: 'VIRTUAL' }, { id: 11, code: 'HYBRID' }]);
	if (sql.includes('FROM academic.course_sections')) return Promise.resolve([]); // dedup: nada existente
	if (sql.includes('INSERT INTO academic.course_sections')) return Promise.resolve([{ id: 500 }]);
	if (sql.includes('INSERT INTO academic.section_professors')) return Promise.resolve([]);
	return Promise.resolve([]);
};

describe('SectionsUploadService (orquestación — réplica de USP_SeccionCargaMasiva)', () => {
	describe('processUpload — camino feliz', () => {
		it('inserta, registra el log y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new SectionsUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['CS101', 'A', 'PROF1', 'LIMA', 'P']]);
			const result = await service.processUpload(buffer, 'secciones.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			expect(result.totalRows).toBe(1);
			expect(result.loadedRows).toBe(1);
			expect(result.errorRows).toBe(0);
			expect(result.uploadLogId).toBe(42);
			expect(result.excelWithErrors).toBeNull();

			expect(uploadLogService.start).toHaveBeenCalledTimes(1);
			expect(uploadLogService.complete).toHaveBeenCalledTimes(1);
			expect(qr.startTransaction).toHaveBeenCalledTimes(1);
			expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
			expect(qr.rollbackTransaction).not.toHaveBeenCalled();
			expect(qr.release).toHaveBeenCalledTimes(1);

			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.course_sections'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.section_professors'))).toBe(true);
		});
	});

	describe('processUpload — con errores de fila (ALL-OR-NOTHING)', () => {
		it('no inserta nada y devuelve el Excel anotado', async () => {
			// courses vacío → la fila falla (courseNotFound); el resto de lookups no importa.
			const qr = makeQueryRunner((sql: string) => {
				if (sql.includes('core.types')) return Promise.resolve([{ id: 8, code: 'IN_PERSON' }]);
				return Promise.resolve([]); // courses/campuses/professors vacíos
			});
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new SectionsUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['NOPE', 'A', 'PROF1', 'LIMA', 'P']]);
			const result = await service.processUpload(buffer, 'secciones.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(result.errorRows).toBe(1);
			expect(result.loadedRows).toBe(0);
			expect(result.uploadLogId).toBeNull();
			expect(typeof result.excelWithErrors).toBe('string');
			expect((result.excelWithErrors as string).length).toBeGreaterThan(0);
			expect(result.fileName).toBe('ErroresCargaSeccion.xlsx');

			// NO se abrió transacción ni se registró carga ni se insertó.
			expect(uploadLogService.start).not.toHaveBeenCalled();
			expect(qr.startTransaction).not.toHaveBeenCalled();
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO'))).toBe(false);
			expect(qr.release).toHaveBeenCalledTimes(1);
		});
	});

	describe('rollback — réplica de USP_Rollback_Seccion', () => {
		it('borra section_professors + course_sections por upload_log_id y marca el log', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new SectionsUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			const calls = qr.manager.query.mock.calls;
			expect(calls[0][0]).toContain('DELETE FROM academic.section_professors');
			expect(calls[0][1]).toEqual([42]);
			expect(calls[1][0]).toContain('DELETE FROM academic.course_sections');
			expect(uploadLogService.markRolledBack).toHaveBeenCalledWith(42, qr.manager);
			expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
			expect(qr.release).toHaveBeenCalledTimes(1);
		});
	});
});
