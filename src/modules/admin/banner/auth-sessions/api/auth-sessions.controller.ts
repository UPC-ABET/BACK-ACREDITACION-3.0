import { HttpStatus, Param } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { AuthSessionService } from './auth-sessions.service';
import {
	SwaggerAuthSessionController,
	SwaggerAuthSessionCreate,
	SwaggerAuthSessionDelete,
	SwaggerAuthSessionGet,
} from './docs/auth-sessions.swagger';

@SwaggerAuthSessionController()
export class AuthSessionController {
	constructor(private readonly service: AuthSessionService) {}

	@SwaggerAuthSessionCreate()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.POST })
	async create(@CurrentUser() user: RequestUser) {
		return parseSuccessResponse(
			await this.service.start(`user:${user.userId}`),
			HttpStatus.CREATED,
		);
	}

	@SwaggerAuthSessionGet()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	get(@Param('id') id: string) {
		return parseSuccessResponse(this.service.getStatus(id));
	}

	@SwaggerAuthSessionDelete()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.DELETE })
	async remove(@Param('id') id: string) {
		return parseSuccessResponse(await this.service.teardown(id));
	}
}
