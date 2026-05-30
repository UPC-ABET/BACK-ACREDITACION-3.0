jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { DelegatesUploadService } from './delegates-upload.service';

const HEADER = ['CodigoCurso', 'CodigoSeccion', 'CodigoAlumno'];

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
	if (sql.includes('FROM academic.student_section_enrollments') && sql.includes('JOIN')) {
		return Promise.resolve([{ id: 500, course_code: 'CS101', section_code: 'A', student_code: 'U001', is_delegate: false }]);
	}
	if (sql.includes('UPDATE academic.student_section_enrollments')) return Promise.resolve([]);
	return Promise.resolve([]);
};

describe('DelegatesUploadService (orquestación — réplica de USP_DelegadosCargaMasiva)', () => {
	describe('processUpload — camino feliz', () => {
		it('UPDATE is_delegate=true sobre SSE, registra log y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new DelegatesUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['CS101', 'A', 'U001']]);
			const result = await service.processUpload(buffer, 'delegados.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			expect(result.loadedRows).toBe(1);
			expect(qr.commitTransaction).toHaveBeenCalledTimes(1);

			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('UPDATE academic.student_section_enrollments') && s.includes('is_delegate'))).toBe(true);
		});
	});

	describe('processUpload — con errores de fila', () => {
		it('SSE no encontrada → Excel anotado, sin UPDATE', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([])); // SSE no existe
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new DelegatesUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['CS101', 'A', 'U999']]);
			const result = await service.processUpload(buffer, 'delegados.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(result.errorRows).toBe(1);
			expect(uploadLogService.start).not.toHaveBeenCalled();
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('UPDATE'))).toBe(false);
		});
	});

	describe('rollback', () => {
		it('UPDATE is_delegate=false sobre filas con extra.delegate_upload_log_id y marca log', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new DelegatesUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			const calls = qr.manager.query.mock.calls;
			expect(calls[0][0]).toContain('UPDATE academic.student_section_enrollments');
			expect(calls[0][0]).toContain('is_delegate');
			expect(calls[0][0]).toContain('delegate_upload_log_id');
			expect(uploadLogService.markRolledBack).toHaveBeenCalledWith(42, qr.manager);
		});
	});
});
