import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { ResponseDto } from 'src/commons/response.dtos';
import { ResponseEncryptionService } from 'src/modules/admin/iam/integration-keys/core/response-encryption.service';
import type { ApiTokenPrincipal } from 'src/modules/auth/model/authorization.types';
import { API_TOKEN_PRINCIPAL } from 'src/modules/auth/protocols/api-key/api-key.constants';
import { ENCRYPTED_RESPONSE_KEY } from '../response-encryption.constants';

@Injectable()
export class EncryptedResponseInterceptor implements NestInterceptor {
	constructor(
		private readonly reflector: Reflector,
		private readonly responseEncryptionService: ResponseEncryptionService,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const isEncrypted = this.reflector.getAllAndOverride<boolean>(ENCRYPTED_RESPONSE_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!isEncrypted) {
			return next.handle();
		}

		const request = context
			.switchToHttp()
			.getRequest<Request & { [API_TOKEN_PRINCIPAL]?: ApiTokenPrincipal }>();
		const principal = request[API_TOKEN_PRINCIPAL];

		// A human caller (JWT/cookie session) hitting an `@EncryptedResponse()` route gets the
		// plaintext response — encryption only applies to a resolved machine principal.
		if (!principal) {
			return next.handle();
		}

		return next.handle().pipe(
			mergeMap(async (body: ResponseDto) => ({
				...body,
				data: await this.responseEncryptionService.encryptForApiToken(
					principal.apiTokenId,
					body.data,
				),
			})),
		);
	}
}
