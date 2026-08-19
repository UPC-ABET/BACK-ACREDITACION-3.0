import { HttpStatus } from '@nestjs/common';
import { SemaphoreReportsService } from './semaphore-reports.service';
import { semaphoreReportsValidationStrings } from '../config/strings/semaphore-reports.validation';

const makeService = () =>
	new SemaphoreReportsService({} as any, {} as any, {} as any) as unknown as {
		runQuery: <T>(read: () => Promise<T>) => Promise<T>;
		renderExcel: (data: unknown, type: 'rc' | 'rv', lang: 'es' | 'en') => Promise<Buffer>;
		buildExcel: (data: unknown, type: 'rc' | 'rv', lang: 'es' | 'en') => Promise<Buffer>;
		toSheetName: (label: string, taken: Set<string>) => string;
	};

describe('SemaphoreReportsService', () => {
	describe('runQuery', () => {
		it('passes through the resolved value on success', async () => {
			const service = makeService();

			await expect(service.runQuery(() => Promise.resolve('ok'))).resolves.toBe('ok');
		});

		it('maps a statement_timeout cancellation (57014) to a 503 with the queryTimeout key', async () => {
			const service = makeService();
			const pgError = Object.assign(new Error('canceling statement due to statement timeout'), {
				code: '57014',
			});

			await expect(service.runQuery(() => Promise.reject(pgError))).rejects.toMatchObject({
				status: HttpStatus.SERVICE_UNAVAILABLE,
				response: {
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.queryTimeout],
				},
			});
		});

		it('maps any other query failure to a 500 with the queryFailed key', async () => {
			const service = makeService();

			await expect(
				service.runQuery(() => Promise.reject(new Error('connection reset'))),
			).rejects.toMatchObject({
				status: HttpStatus.INTERNAL_SERVER_ERROR,
				response: {
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.queryFailed],
				},
			});
		});
	});

	describe('renderExcel', () => {
		it('returns the workbook buffer on success', async () => {
			const service = makeService();
			const buffer = Buffer.from('xlsx');
			jest.spyOn(service, 'buildExcel').mockResolvedValue(buffer);

			await expect(service.renderExcel({} as never, 'rc', 'es')).resolves.toBe(buffer);
		});

		it('maps a workbook build failure to a 500 with the excelFailed key', async () => {
			const service = makeService();
			jest.spyOn(service, 'buildExcel').mockRejectedValue(new Error('duplicate sheet name'));

			await expect(service.renderExcel({} as never, 'rc', 'es')).rejects.toMatchObject({
				status: HttpStatus.INTERNAL_SERVER_ERROR,
				response: {
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.excelFailed],
				},
			});
		});
	});

	describe('toSheetName', () => {
		it('returns the label unchanged when it fits and is not taken', () => {
			const service = makeService();

			expect(service.toSheetName('Red', new Set())).toBe('Red');
		});

		it('strips characters Excel rejects in a sheet name', () => {
			const service = makeService();

			expect(service.toSheetName('Red/Yellow:Green', new Set())).toBe('Red Yellow Green');
		});

		it('truncates to the 31-character Excel limit', () => {
			const service = makeService();
			const long = 'A'.repeat(50);

			const name = service.toSheetName(long, new Set());

			expect(name).toHaveLength(31);
			expect(name).toBe('A'.repeat(31));
		});

		it('suffixes a collision instead of reusing a taken name', () => {
			const service = makeService();
			const taken = new Set<string>();

			const first = service.toSheetName('Red', taken);
			const second = service.toSheetName('Red', taken);

			expect(first).toBe('Red');
			expect(second).toBe('Red 2');
			expect(taken).toEqual(new Set(['Red', 'Red 2']));
		});

		it('keeps every suffixed collision within the 31-character limit', () => {
			const service = makeService();
			const long = 'B'.repeat(31);
			const taken = new Set<string>([long]);

			const name = service.toSheetName(long, taken);

			expect(name.length).toBeLessThanOrEqual(31);
			expect(name).toBe(`${'B'.repeat(29)} 2`);
		});
	});
});
