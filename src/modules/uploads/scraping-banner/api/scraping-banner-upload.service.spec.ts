jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }), { virtual: true });
jest.mock('typeorm', () => ({ DataSource: class {}, EntityManager: class {} }), { virtual: true });
jest.mock('../../upload-logs/api/upload-logs.service', () => ({ UploadLogService: class {} }), { virtual: true });

import * as ExcelJS from 'exceljs';
import { ScrapingBannerUploadService } from './scraping-banner-upload.service';

const HEADER = ['CodigoAlumno', 'Nombres', 'Apellidos', 'CorreoInstitucional', 'CorreoPersonal', 'TelefonoMovil', 'ProgramaCodigo', 'NivelCodigo', 'PeriodoCodigo', 'CampusCodigo', 'MetodoEducativoCodigo', 'Nrc', 'CursoCodigoFull', 'DocenteIdBanner'];

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
	if (sql.includes('FROM academic.academic_periods')) return Promise.resolve([{ id: 1, code: '2024-1' }]);
	if (sql.includes('FROM organization.campuses')) return Promise.resolve([{ id: 30, code: 'LIMA' }]);
	if (sql.includes('FROM academic.courses')) return Promise.resolve([{ id: 10, code: 'CS101' }]);
	if (sql.includes('FROM academic.professors')) return Promise.resolve([{ id: 20, code: 'PROF1' }]);
	if (sql.includes('core.types')) return Promise.resolve([{ id: 100, code: 'UG' }, { id: 101, code: 'IN_PERSON' }]);
	if (sql.includes('SELECT id FROM organization.users')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO organization.users')) return Promise.resolve([{ id: 700 }]);
	if (sql.includes('SELECT id FROM academic.students')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO academic.students')) return Promise.resolve([{ id: 800 }]);
	if (sql.includes('FROM academic.study_plan_academic_periods')) return Promise.resolve([{ id: 200 }]);
	if (sql.includes('INSERT INTO academic.enrolled_students')) return Promise.resolve([{ id: 900 }]);
	if (sql.includes('FROM academic.study_plan_courses')) return Promise.resolve([{ id: 400 }]);
	if (sql.includes('SELECT cs.id FROM academic.course_sections')) return Promise.resolve([]);
	if (sql.includes('INSERT INTO academic.course_sections')) return Promise.resolve([{ id: 500 }]);
	if (sql.includes('INSERT INTO academic.student_section_enrollments')) return Promise.resolve([]);
	return Promise.resolve([]);
};

describe('ScrapingBannerUploadService (orquestación — C1+C2)', () => {
	describe('processUpload — camino feliz', () => {
		it('inserta cadena users→students→enrolled→cs→sse y retorna success', async () => {
			const qr = makeQueryRunner(happyQuery);
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = {
				start: jest.fn().mockResolvedValue({ id: 42 }),
				complete: jest.fn().mockResolvedValue(undefined),
				markRolledBack: jest.fn(),
			};
			const service = new ScrapingBannerUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['U001', 'Juan', 'Perez', 'u001@upc', '', '', 'INF', 'UG', '2024-1', 'LIMA', 'IN_PERSON', 'A', 'CS101', 'PROF1']]);
			const result = await service.processUpload(buffer, 'banner.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(true);
			const sqls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(sqls.some((s) => s.includes('INSERT INTO organization.users'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.students'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.enrolled_students'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.course_sections'))).toBe(true);
			expect(sqls.some((s) => s.includes('INSERT INTO academic.student_section_enrollments'))).toBe(true);
		});
	});

	describe('processUpload — con errores', () => {
		it('curso no existe → Excel anotado, sin INSERT', async () => {
			const qr = makeQueryRunner((sql: string) => {
				if (sql.includes('FROM academic.programs')) return Promise.resolve([{ id: 5, code: 'INF' }]);
				if (sql.includes('FROM academic.academic_periods')) return Promise.resolve([{ id: 1, code: '2024-1' }]);
				if (sql.includes('FROM organization.campuses')) return Promise.resolve([{ id: 30, code: 'LIMA' }]);
				if (sql.includes('FROM academic.professors')) return Promise.resolve([{ id: 20, code: 'PROF1' }]);
				if (sql.includes('core.types')) return Promise.resolve([{ id: 100, code: 'UG' }, { id: 101, code: 'IN_PERSON' }]);
				return Promise.resolve([]); // courses vacío
			});
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { start: jest.fn(), complete: jest.fn(), markRolledBack: jest.fn() };
			const service = new ScrapingBannerUploadService(dataSource, uploadLogService);

			const buffer = await makeXlsx([['U001', 'Juan', 'Perez', 'u001@upc', '', '', 'INF', 'UG', '2024-1', 'LIMA', 'IN_PERSON', 'A', 'NOPE', 'PROF1']]);
			const result = await service.processUpload(buffer, 'banner.xlsx', { academic_period_id: 1 } as any);

			expect(result.success).toBe(false);
			expect(uploadLogService.start).not.toHaveBeenCalled();
		});
	});

	describe('rollback', () => {
		it('borra sse → cs → enrolled → students y marca log', async () => {
			const qr = makeQueryRunner(() => Promise.resolve([]));
			const dataSource: any = { createQueryRunner: () => qr };
			const uploadLogService: any = { markRolledBack: jest.fn().mockResolvedValue(undefined) };
			const service = new ScrapingBannerUploadService(dataSource, uploadLogService);

			const result = await service.rollback(42);

			expect(result.success).toBe(true);
			const calls = qr.manager.query.mock.calls.map((c: any[]) => c[0] as string);
			expect(calls.some((s) => s.includes('DELETE FROM academic.student_section_enrollments'))).toBe(true);
			expect(calls.some((s) => s.includes('DELETE FROM academic.course_sections'))).toBe(true);
			expect(calls.some((s) => s.includes('DELETE FROM academic.enrolled_students'))).toBe(true);
			expect(calls.some((s) => s.includes('DELETE FROM academic.students'))).toBe(true);
		});
	});
});
