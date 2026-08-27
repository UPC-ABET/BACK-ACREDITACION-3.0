import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UnauthorizedError } from 'src/commons/domain-error';
import { ApiTokenAuthService } from 'src/modules/admin/iam/api-tokens/core/api-token-auth.service';
import { apiTokensValidationStrings } from 'src/modules/admin/iam/api-tokens/config/strings/api-tokens.validation';
import { IS_PUBLIC_KEY } from 'src/modules/auth/protocols/jwt/decorators/public.decorator';
import { API_KEY_HEADER, API_TOKEN_PRINCIPAL } from '../api-key.constants';
import { API_TOKEN_AUTH_KEY } from '../decorators/api-token-auth.decorator';

@Injectable()
export class ApiTokenAuthGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly authService: ApiTokenAuthService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();
		const rawKey = request.headers[API_KEY_HEADER] as string | undefined;

		if (!rawKey) {
			return true;
		}

		const isOptedIn = this.reflector.getAllAndOverride<boolean>(API_TOKEN_AUTH_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!isOptedIn) {
			throw new UnauthorizedError(apiTokensValidationStrings.error.unauthorizedRoute);
		}

		const separatorIndex = rawKey.indexOf('.');
		if (separatorIndex <= 0 || separatorIndex === rawKey.length - 1) {
			throw new UnauthorizedError(apiTokensValidationStrings.error.invalidApiKey);
		}

		const keyId = rawKey.slice(0, separatorIndex);
		const secret = rawKey.slice(separatorIndex + 1);

		const principal = await this.authService.resolve(keyId, secret);

		(request as any)[API_TOKEN_PRINCIPAL] = principal;

		return true;
	}
}
