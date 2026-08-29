import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import {
	SwaggerIntegrationKeyController,
	SwaggerIntegrationKeyGetAll,
	SwaggerIntegrationKeyGetByApiToken,
	SwaggerIntegrationKeyIssue,
	SwaggerIntegrationKeyRotate,
} from './docs/integration-keys.swagger';
import { IntegrationKeyService } from './integration-keys.service';
import { IssueIntegrationKeyDto } from '../model/integration-keys.dtos';

/**
 * Admin CRUD for per-integration response-encryption keys. Deliberately carries no
 * `@ApiTokenAuth()`, same reasoning as `ApiTokenController`: a token must not be able to rotate its
 * own encryption key. Only human, JWT-authenticated ADMIN callers reach this controller.
 */
@SwaggerIntegrationKeyController()
export class IntegrationKeyController extends BaseController<IntegrationKeyService> {
	constructor(private readonly service: IntegrationKeyService) {
		super(service);
	}

	@SwaggerIntegrationKeyIssue()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async issue(@Body() dto: IssueIntegrationKeyDto, @CurrentUser() user: RequestUser) {
		return parseSuccessResponse(await this.service.issue(dto, user.userId), HttpStatus.CREATED);
	}

	@SwaggerIntegrationKeyRotate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async rotate(
		@Param('apiTokenId', ParseIntPipe) apiTokenId: number,
		@CurrentUser() user: RequestUser,
	) {
		return parseSuccessResponse(await this.service.rotate(apiTokenId, user.userId));
	}

	@SwaggerIntegrationKeyGetByApiToken()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getByApiToken(@Param('apiTokenId', ParseIntPipe) apiTokenId: number) {
		return parseSuccessResponse(await this.service.getByApiToken(apiTokenId));
	}

	@SwaggerIntegrationKeyGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}
}
