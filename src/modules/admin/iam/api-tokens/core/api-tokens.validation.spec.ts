import { BadRequestError } from 'src/commons/domain-error';
import { ApiTokenValidation } from './api-tokens.validation';

describe('ApiTokenValidation', () => {
	describe('validateCreate', () => {
		it('accepts scopes whose module and action are both known', () => {
			expect(() =>
				ApiTokenValidation.validateCreate({
					scopes: [{ module: 'ADMIN', action: 'GET' }],
				}),
			).not.toThrow();
		});

		it('rejects an empty scopes array', () => {
			expect(() => ApiTokenValidation.validateCreate({ scopes: [] })).toThrow(BadRequestError);
		});

		it('rejects a scope referencing an unknown module', () => {
			expect(() =>
				ApiTokenValidation.validateCreate({
					scopes: [{ module: 'NOT_A_MODULE', action: 'GET' }],
				}),
			).toThrow(BadRequestError);
		});

		it('rejects a scope referencing an unknown action', () => {
			expect(() =>
				ApiTokenValidation.validateCreate({
					scopes: [{ module: 'ADMIN', action: 'NOT_AN_ACTION' }],
				}),
			).toThrow(BadRequestError);
		});
	});

	describe('validateRevoke', () => {
		it('accepts an active token entity', () => {
			expect(() =>
				ApiTokenValidation.validateRevoke({ isActive: true, revokedAt: null } as any),
			).not.toThrow();
		});

		it('rejects a missing token', () => {
			expect(() => ApiTokenValidation.validateRevoke(null)).toThrow(BadRequestError);
		});

		it('rejects an already-revoked token without partial effect', () => {
			expect(() =>
				ApiTokenValidation.validateRevoke({ isActive: false, revokedAt: new Date() } as any),
			).toThrow(BadRequestError);
		});
	});
});
