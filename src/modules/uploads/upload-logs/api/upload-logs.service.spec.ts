jest.mock('../core/upload-logs.repository', () => ({ UploadLogRepository: class {} }), {
	virtual: true,
});
jest.mock('../model/upload-logs.entity', () => ({ UploadLogEntity: class {} }), { virtual: true });

import { HttpException, HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UploadLogService } from './upload-logs.service';

function pgError(code: string, message: string): QueryFailedError {
	return new QueryFailedError('SELECT 1', [], { code, message } as unknown as Error);
}

describe('UploadLogService.rethrowRollbackError', () => {
	const service = new UploadLogService({} as never);

	it('maps a P0001 rollback raise to the matching frontend key (409)', () => {
		let caught: HttpException | undefined;
		try {
			service.rethrowRollbackError(pgError('P0001', 'rollbackBlockedNewerUpload'));
		} catch (e) {
			caught = e as HttpException;
		}
		expect(caught).toBeInstanceOf(HttpException);
		expect(caught!.getStatus()).toBe(HttpStatus.CONFLICT);
		expect((caught!.getResponse() as { message: string }).message).toBe(
			'error.uploads.rollbackBlockedNewerUpload',
		);
	});

	it('maps uploadLogNotFound to 404', () => {
		let caught: HttpException | undefined;
		try {
			service.rethrowRollbackError(pgError('P0001', 'uploadLogNotFound'));
		} catch (e) {
			caught = e as HttpException;
		}
		expect(caught!.getStatus()).toBe(HttpStatus.NOT_FOUND);
		expect((caught!.getResponse() as { message: string }).message).toBe(
			'error.uploads.uploadLogNotFound',
		);
	});

	it('rethrows an unmapped raise unchanged', () => {
		const err = pgError('P0001', 'somethingElse');
		expect(() => service.rethrowRollbackError(err)).toThrow(err);
	});

	it('rethrows a non-P0001 DB error unchanged (→ generic 500 upstream)', () => {
		const err = pgError('23503', 'fk_violation');
		expect(() => service.rethrowRollbackError(err)).toThrow(err);
	});

	it('rethrows a plain error unchanged', () => {
		const err = new Error('boom');
		expect(() => service.rethrowRollbackError(err)).toThrow(err);
	});
});
