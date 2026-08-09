import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { DomainError } from 'src/commons/domain-error';
import { SavePlannerCredentialsDto } from '../model/planner-credentials.dtos';
import { PlannerCredentialsValidation } from './planner-credentials.validation';

const VALID = { username: 'planner-operator', password: 'example-pw' };

describe('PlannerCredentialsValidation', () => {
	describe('parse', () => {
		it('returns the pair when the body is well formed', () => {
			expect(PlannerCredentialsValidation.parse(VALID)).toMatchObject(VALID);
		});

		// Each of these is a live u-planner login attempt if it gets through, and a failed attempt
		// arms a throttle shared by every operator.
		it.each([
			['an object', { a: 1 }],
			['an array', [1, 2]],
			['a number', 12345],
			['a boolean', true],
			['null', null],
			['absent', undefined],
		])('rejects a password that is %s', (_label, password) => {
			expect(() => PlannerCredentialsValidation.parse({ ...VALID, password })).toThrow(DomainError);
		});

		it.each([
			['an object', { a: 1 }],
			['a number', 12345],
		])('rejects a username that is %s', (_label, username) => {
			expect(() => PlannerCredentialsValidation.parse({ ...VALID, username })).toThrow(DomainError);
		});

		it('rejects unknown properties', () => {
			expect(() => PlannerCredentialsValidation.parse({ ...VALID, extra: 'x' })).toThrow(
				DomainError,
			);
		});

		it('rejects a body that is not an object at all', () => {
			expect(() => PlannerCredentialsValidation.parse('not-a-body')).toThrow(DomainError);
		});

		it('reports the failing constraints rather than a bare key', () => {
			const error = (() => {
				try {
					PlannerCredentialsValidation.parse({ ...VALID, password: { a: 1 } });
					return null;
				} catch (e) {
					return e as DomainError;
				}
			})();

			expect(error?.errors?.join(' ')).toMatch(/password/);
		});
	});

	/**
	 * The reason this validation exists at all, pinned as a test so it cannot be "simplified" back
	 * into the DTO: the global pipe's `enableImplicitConversion` stringifies *before* any validator
	 * or `@Transform` runs, so by the time a DTO decorator could look, an object has already become
	 * the plausible string `"[object Object]"`. Nest runs global pipes ahead of route-scoped ones,
	 * so no pipe on this endpoint can see the original either.
	 */
	it('documents why the DTO alone cannot enforce this', async () => {
		const globalPipe = new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
			transformOptions: { enableImplicitConversion: true },
		});
		const meta: ArgumentMetadata = { type: 'body', metatype: SavePlannerCredentialsDto, data: '' };

		await expect(globalPipe.transform({ ...VALID, password: { a: 1 } }, meta)).resolves.toEqual(
			expect.objectContaining({ password: '[object Object]' }), // abet-allow-secret: String({a:1})
		);
	});
});
