jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { ChartsUploadService } from './charts-upload.service';

const HEADER = ['EntityCode', 'Name', 'Level', 'EntityType', 'Responsible', 'Campus', 'ParentEntityCode'];

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
	if (sql.includes('FROM organization.chart_levels')) return Promise.resolve([{ id: 10, level: 1 }]);
	if (sql.includes('core.types')) return Promise.resolve([{ id: 100, code: 'SCHOOL' }]);
	if (sql.includes('FROM academic.professors')) return Promise.resolve([{ id: 50, code: 'user@upc' }]);
	if (sql.includes('FROM organization.campuses')) return Promise.resolve([]);
	if (sql.includes('FROM organization.charts')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO organization.charts')) return Promise.resolve([{ id: 700 }]);
	return Promise.resolve([]);
};

describe('ChartsUploadService (orquestación)', () => {
	describe('processUpload — camino feliz', () => {
		it('inserta charts y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new ChartsUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['E001', 'Escuela', '1', 'SCHOOL', 'user@upc', '', '']]);
			const result = await service.processUpload(buffer, 'org.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO organization.charts'))).toBe(true);
		});
	});

	describe('processUpload — con errores', () => {
		it('staff no existe → Excel anotado, sin INSERT', async () => {
			const qr = makeQueryRunner((sql: string) => {
				if (sql.includes('chart_levels')) return Promise.resolve([{ id: 10, level: 1 }]);
				if (sql.includes('core.types')) return Promise.resolve([{ id: 100, code: 'SCHOOL' }]);
				return Promise.resolve([]);
			});
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new ChartsUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['E001', 'Escuela', '1', 'SCHOOL', 'unknown@x', '', '']]);
			const result = await service.processUpload(buffer, 'org.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(uploadLogService.start).not.toHaveBeenCalled();
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO'))).toBe(false);
		});
	});

	describe('rollback', () => {
		it('UPDATE parent NULL + DELETE charts y marca log', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new ChartsUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			const calls = qr.manager.query.mock.calls;
			expect(calls[0][0]).toContain('UPDATE organization.charts');
			expect(calls[0][0]).toContain('root_chart_detail_id = NULL');
			expect(calls[1][0]).toContain('DELETE FROM organization.charts');
			expect(uploadLogService.markRolledBack).toHaveBeenCalledWith(42, qr.manager);
		});
	});
});
