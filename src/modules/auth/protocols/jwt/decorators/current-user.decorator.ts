import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { RequestUser } from 'src/modules/auth/model/authorization.types';

export const CurrentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): RequestUser =>
		ctx.switchToHttp().getRequest<Request & { user: RequestUser }>().user,
);
