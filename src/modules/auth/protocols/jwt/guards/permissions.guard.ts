import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { authValidationStrings } from '../../../config/strings/auth.validation';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_PERMISSIONS_KEY } from '../decorators/skip-permissions.decorator';
import {
	REQUIRED_PERMISSION_KEY,
	RequiredPermission,
} from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		const skipPermissions = this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSIONS_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic || skipPermissions) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request & { user?: any }>();

		if (this.isAdmin(request.user?.activeRole)) {
			return true;
		}

		const requiredPermission = this.reflector.getAllAndOverride<RequiredPermission>(
			REQUIRED_PERMISSION_KEY,
			[context.getHandler(), context.getClass()],
		);
		if (!requiredPermission) {
			throw new ForbiddenException(authValidationStrings.error.noPermissionsConfigured);
		}

		const permissions = request.user?.permissions ?? [];

		const canAccess = permissions.some((permission) => {
			if (!permission?.module || !Array.isArray(permission.permissions)) {
				return false;
			}

			const allowedActions = (permission?.permissions ?? []).map((allowedAction) =>
				String(allowedAction).toUpperCase(),
			);
			const allowedModule = String(permission.module).toUpperCase();

			return (
				allowedModule === requiredPermission.module &&
				allowedActions.includes(requiredPermission.action)
			);
		});

		if (!canAccess) {
			throw new ForbiddenException(authValidationStrings.error.accessDenied);
		}

		return true;
	}

	private isAdmin(activeRole?: any) {
		const code = activeRole?.code?.toUpperCase?.();

		return code === 'ADMIN';
	}
}
