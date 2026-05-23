import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_PERMISSIONS_KEY } from '../decorators/skip-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
		const skipPermissions = this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

		if (isPublic || skipPermissions) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request & { user?: any }>();
		const method = request.method.toUpperCase();
		const requestPath = this.normalizeRequestPath(request.path || request.originalUrl || request.url);
		const permissions = request.user?.permissions ?? [];

		const canAccess = permissions.some((permission) => {
			const allowedMethods = (permission?.permissions ?? []).map((allowedMethod) => allowedMethod.toUpperCase());
			const allowedRoute = this.normalizePermissionRoute(permission?.route);

			return allowedMethods.includes(method) && this.routeMatches(requestPath, allowedRoute);
		});

		if (!canAccess) {
			throw new ForbiddenException('No tienes permisos para acceder a este recurso');
		}

		return true;
	}

	private normalizeRequestPath(path: string) {
		const cleanPath = this.normalizePath(path.split('?')[0]);
		return cleanPath.startsWith('/api/') ? cleanPath.slice(4) : cleanPath;
	}

	private normalizePermissionRoute(route: string) {
		return this.normalizePath(route);
	}

	private normalizePath(path: string) {
		const normalized = `/${(path ?? '').replace(/^\/+|\/+$/g, '')}`;
		return normalized === '/' ? normalized : normalized.toLowerCase();
	}

	private routeMatches(requestPath: string, permissionRoute: string) {
		return requestPath === permissionRoute || requestPath.startsWith(`${permissionRoute}/`);
	}
}
