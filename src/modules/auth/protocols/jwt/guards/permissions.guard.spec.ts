import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
	let reflector: { getAllAndOverride: jest.Mock };
	let guard: PermissionsGuard;

	const permission = {
		id: 6,
		code: 'TG2001-T002',
		module: 'IFCS',
		route: '/ifcs',
		permissions: ['GET', 'POST'],
	};

	beforeEach(() => {
		reflector = {
			getAllAndOverride: jest.fn().mockReturnValue(false),
		};
		guard = new PermissionsGuard(reflector as unknown as Reflector);
	});

	it('allows requests when method and module route match a token permission', () => {
		const context = createContext({
			method: 'POST',
			path: '/api/ifcs/create',
			user: { permissions: [permission] },
		});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('blocks requests when the module route is not present in token permissions', () => {
		const context = createContext({
			method: 'GET',
			path: '/api/schools/get-all',
			user: { permissions: [permission] },
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it('blocks requests when the route matches but the HTTP method is not allowed', () => {
		const context = createContext({
			method: 'DELETE',
			path: '/api/ifcs/delete/10',
			user: { permissions: [permission] },
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it('allows admin active role to access any endpoint', () => {
		const context = createContext({
			method: 'DELETE',
			path: '/api/schools/delete/10',
			user: {
				activeRole: { id: 1, code: 'ADMIN', name: { en: 'Admin', es: 'Administrador' } },
				permissions: [],
			},
		});

		expect(guard.canActivate(context)).toBe(true);
	});
});

function createContext(request: { method: string; path: string; user: any }) {
	return {
		getHandler: jest.fn(),
		getClass: jest.fn(),
		switchToHttp: () => ({
			getRequest: () => request,
		}),
	} as any;
}
