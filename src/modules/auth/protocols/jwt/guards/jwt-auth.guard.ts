import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { API_TOKEN_PRINCIPAL } from 'src/modules/auth/protocols/api-key/api-key.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	constructor(private reflector: Reflector) {
		super();
	}

	canActivate(context: ExecutionContext) {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		// A machine principal was already resolved by ApiTokenAuthGuard (registered ahead of this
		// guard) — the JWT flow is not applicable to this request. Unreachable when no `X-Api-Key`
		// was presented, so the human flow is byte-identical to before this change (AC-2/D2).
		if ((context.switchToHttp().getRequest() as any)[API_TOKEN_PRINCIPAL]) {
			return true;
		}

		return super.canActivate(context);
	}
}
