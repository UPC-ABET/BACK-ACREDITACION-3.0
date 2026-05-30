jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { GradesBannerUploadService } from './grades-banner-upload.service';

const HEADER = ['CodigoAlumno', 'CursoCodigo', 'Nrc', 'TipoNota', 'Nota', 'Peso'];

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
	if (sql.includes('FROM academic.student_section_enrollments')) {
		return Promise.resolve([{ id: 500, course_code: 'CS101', section_code: 'A', student_code: 'U001' }]);
	}
	if (sql.includes('core.types') && params?.[0] === 'GRADE_TYPE') {
		return Promise.resolve([{ id: 1, code: 'GRADE_PARTIAL' }, { id: 2, code: 'GRADE_FINAL' }]);
	}
	if (sql.includes('FROM academic.student_course_grades')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO academic.student_course_grades')) return Promise.resolve([]);
	return Promise.resolve([]);
};

describe('GradesBannerUploadService (orquestación — réplica de usp_InsertarAlumnoNotasRCBannerScraping)', () => {
	describe('processUpload — camino feliz', () => {
		it('1 fila → 1 INSERT y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new GradesBannerUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['U001', 'CS101', 'A', 'GRADE_PARTIAL', '15', '30']]);
			const result = await service.processUpload(buffer, 'notas.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			const inserts = sqls.filter((s) => s.includes('INSERT INTO academic.student_course_grades'));
			expect(inserts.length).toBe(1);
		});
	});

	describe('processUpload — con errores', () => {
		it('SSE no encontrada → Excel anotado, sin INSERT', async () => {
			const qr = makeQueryRunner((sql: string, params?: any[]) => {
				if (sql.includes('core.types') && params?.[0] === 'GRADE_TYPE') return Promise.resolve([{ id: 1, code: 'GRADE_PARTIAL' }]);
				return Promise.resolve([]);
			});
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new GradesBannerUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['U999', 'CS101', 'A', 'GRADE_PARTIAL', '15', '30']]);
			const result = await service.processUpload(buffer, 'notas.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(uploadLogService.start).not.toHaveBeenCalled();
		});
	});

	describe('rollback', () => {
		it('DELETE por extra.grade_upload_log_id', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new GradesBannerUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			expect(qr.manager.query.mock.calls[0][0]).toContain('DELETE FROM academic.student_course_grades');
			expect(qr.manager.query.mock.calls[0][0]).toContain('grade_upload_log_id');
		});
	});
});
