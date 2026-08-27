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
import { isAdmin } from 'src/modules/auth/model/authorization.functions';
import type { ApiTokenPrincipal, RequestUser } from 'src/modules/auth/model/authorization.types';
import { ForbiddenError } from 'src/commons/domain-error';
import { API_TOKEN_PRINCIPAL } from 'src/modules/auth/protocols/api-key/api-key.constants';
import { apiTokensValidationStrings } from 'src/modules/admin/iam/api-tokens/config/strings/api-tokens.validation';

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

		const request = context
			.switchToHttp()
			.getRequest<Request & { user?: RequestUser; [API_TOKEN_PRINCIPAL]?: ApiTokenPrincipal }>();

		const machine = request[API_TOKEN_PRINCIPAL];

		// The isAdmin short-circuit is human-only by construction (D4): ApiTokenPrincipal has no
		// `roles` field, so a machine principal must never reach it, even if `request.user`
		// independently carries an ADMIN role.
		if (!machine && isAdmin(request.user)) {
			return true;
		}

		const requiredPermission = this.reflector.getAllAndOverride<RequiredPermission>(
			REQUIRED_PERMISSION_KEY,
			[context.getHandler(), context.getClass()],
		);
		if (!requiredPermission) {
			throw new ForbiddenException(authValidationStrings.error.noPermissionsConfigured);
		}

		const permissions = machine ? machine.permissions : (request.user?.permissions ?? []);

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
			if (machine) {
				throw new ForbiddenError(apiTokensValidationStrings.error.insufficientScope);
			}
			throw new ForbiddenException(authValidationStrings.error.accessDenied);
		}

		return true;
	}
}
