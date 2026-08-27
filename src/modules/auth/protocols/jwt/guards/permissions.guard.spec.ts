import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import {
	REQUIRED_PERMISSION_KEY,
	RequiredPermission,
} from '../decorators/require-permission.decorator';
import { ForbiddenError } from 'src/commons/domain-error';
import { API_TOKEN_PRINCIPAL } from 'src/modules/auth/protocols/api-key/api-key.constants';

describe('PermissionsGuard', () => {
	let reflector: { getAllAndOverride: jest.Mock };
	let guard: PermissionsGuard;
	let requiredPermission: RequiredPermission | undefined;

	const permission = {
		id: 6,
		code: 'TG2001-T002',
		module: 'IFCS',
		route: '/ifcs',
		permissions: ['GET', 'POST'],
	};

	beforeEach(() => {
		requiredPermission = { module: 'IFCS', action: 'POST' };
		reflector = {
			getAllAndOverride: jest.fn((key: string) => {
				if (key === REQUIRED_PERMISSION_KEY) return requiredPermission;
				return false;
			}),
		};
		guard = new PermissionsGuard(reflector as unknown as Reflector);
	});

	it('allows requests when module and action match a token permission', () => {
		const context = createContext({
			user: { permissions: [permission] },
		});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('blocks requests when the required module is not present in token permissions', () => {
		requiredPermission = { module: 'SCHOOLS', action: 'GET' };
		const context = createContext({
			user: { permissions: [permission] },
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it('blocks requests when the module matches but the action is not allowed', () => {
		requiredPermission = { module: 'IFCS', action: 'DELETE' };
		const context = createContext({
			user: { permissions: [permission] },
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it('blocks requests when the endpoint has no permission metadata', () => {
		requiredPermission = undefined;
		const context = createContext({
			user: { permissions: [permission] },
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it('allows a user with an admin role to access any endpoint', () => {
		requiredPermission = undefined;
		const context = createContext({
			user: {
				roles: [{ id: 1, code: 'ADMIN', name: { en: 'Admin', es: 'Administrador' } }],
				permissions: [],
			},
		});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('does not allow admin bypass by magic numeric id alone', () => {
		const context = createContext({
			user: {
				roles: [{ id: 1, name: { en: 'Admin', es: 'Administrador' } }],
				permissions: [],
			},
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it('allows a machine principal whose scopes match the required permission', () => {
		const context = createContext({
			[API_TOKEN_PRINCIPAL]: {
				apiTokenId: 1,
				keyId: 'abc123',
				name: 'Integration X',
				permissions: [{ module: 'IFCS', permissions: ['POST'] }],
			},
		});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('blocks a machine principal whose scopes do not match, raising ForbiddenError not UnauthorizedError', () => {
		const context = createContext({
			[API_TOKEN_PRINCIPAL]: {
				apiTokenId: 1,
				keyId: 'abc123',
				name: 'Integration X',
				permissions: [{ module: 'IFCS', permissions: ['GET'] }],
			},
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
	});

	it('does not let a machine principal short-circuit via isAdmin even when request.user independently carries an ADMIN role', () => {
		requiredPermission = { module: 'IFCS', action: 'DELETE' };
		const context = createContext({
			user: {
				roles: [{ id: 1, code: 'ADMIN', name: { en: 'Admin', es: 'Administrador' } }],
				permissions: [],
			},
			[API_TOKEN_PRINCIPAL]: {
				apiTokenId: 1,
				keyId: 'abc123',
				name: 'Integration X',
				permissions: [{ module: 'IFCS', permissions: ['GET'] }],
			},
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
	});
});

function createContext(request: Record<string, any>) {
	return {
		getHandler: jest.fn(),
		getClass: jest.fn(),
		switchToHttp: () => ({
			getRequest: () => request,
		}),
	} as any;
}
