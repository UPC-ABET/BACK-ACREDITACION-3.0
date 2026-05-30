jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { ProfessorsUploadService } from './professors-upload.service';

const HEADER = ['UserName', 'Name'];

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

// Router de queries para el camino feliz.
const happyQuery = (sql: string) => {
	if (sql.includes('core.types')) return Promise.resolve([{ id: 11, code: 'DOCENTE' }]);
	if (sql.includes('FROM organization.staff')) return Promise.resolve([]); // sin dedup
	if (sql.includes('INSERT INTO organization.users')) return Promise.resolve([{ id: 100 }]);
	if (sql.includes('INSERT INTO organization.staff')) return Promise.resolve([{ id: 200 }]);
	if (sql.includes('INSERT INTO academic.professors')) return Promise.resolve([]);
	return Promise.resolve([]);
};

describe('ProfessorsUploadService (orquestación — réplica de USP_DocenteCargaMasiva)', () => {
	describe('processUpload — camino feliz', () => {
		it('inserta users+staff+professors, registra log y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new ProfessorsUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['juan.perez@upc.edu.pe', 'Juan Perez']]);
			const result = await service.processUpload(buffer, 'docentes.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			expect(result.loadedRows).toBe(1);
			expect(result.uploadLogId).toBe(42);
			expect(uploadLogService.start).toHaveBeenCalledTimes(1);
			expect(uploadLogService.complete).toHaveBeenCalledTimes(1);
			expect(qr.commitTransaction).toHaveBeenCalledTimes(1);

			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO organization.users'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO organization.staff'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.professors'))).toBe(true);
		});
	});

	describe('processUpload — con errores de fila (ALL-OR-NOTHING)', () => {
		it('no inserta nada y devuelve el Excel anotado', async () => {
			const qr = makeQueryRunner((sql: string) => {
				if (sql.includes('core.types')) return Promise.resolve([]); // DOCENTE no existe → positionTypeMissing
				return Promise.resolve([]);
			});
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new ProfessorsUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['juan@upc.edu.pe', 'Juan Perez']]);
			const result = await service.processUpload(buffer, 'docentes.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(result.errorRows).toBe(1);
			expect(typeof result.excelWithErrors).toBe('string');
			expect(uploadLogService.start).not.toHaveBeenCalled();
			expect(qr.startTransaction).not.toHaveBeenCalled();
		});
	});

	describe('rollback', () => {
		it('borra professors + staff y marca el log', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new ProfessorsUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('DELETE FROM academic.professors'))).toBe(true);
			expect(sqls.some((s) => s.includes('DELETE FROM organization.staff'))).toBe(true);
			expect(uploadLogService.markRolledBack).toHaveBeenCalledWith(42, qr.manager);
			expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
		});
	});
});
