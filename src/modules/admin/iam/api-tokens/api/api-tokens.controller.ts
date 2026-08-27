import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import {
	SwaggerApiTokenController,
	SwaggerApiTokenCreate,
	SwaggerApiTokenDelete,
	SwaggerApiTokenGetAll,
	SwaggerApiTokenGetByFilters,
	SwaggerApiTokenGetById,
	SwaggerApiTokenUpdate,
} from './docs/api-tokens.swagger';
import { ApiTokenService } from './api-tokens.service';
import { CreateApiTokenDto, FilterApiTokenDto, UpdateApiTokenDto } from '../model/api-tokens.dtos';

/**
 * Admin CRUD for machine-to-machine API tokens. Deliberately carries no `@ApiTokenAuth()` (D6):
 * a token could otherwise mint tokens for itself. Only human, JWT-authenticated ADMIN callers
 * reach this controller.
 */
@SwaggerApiTokenController()
export class ApiTokenController extends BaseController<ApiTokenService> {
	constructor(private readonly service: ApiTokenService) {
		super(service);
	}

	// Named `issue`, not `create`: the extra `@CurrentUser()` parameter is incompatible with
	// `BaseController.create`'s single-argument signature (mirrors `ApiTokenService.issue`).
	@SwaggerApiTokenCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async issue(@Body() dto: CreateApiTokenDto, @CurrentUser() user: RequestUser) {
		return parseSuccessResponse(await this.service.issue(dto, user.userId), HttpStatus.CREATED);
	}

	@SwaggerApiTokenUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateApiTokenDto) {
		return await this.service.update(id, dto);
	}

	// Named `revoke`, not `delete`: same signature-compatibility reason as `issue` above.
	@SwaggerApiTokenDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.DELETE })
	async revoke(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
		return parseSuccessResponse(await this.service.revoke(id, user.userId));
	}

	@SwaggerApiTokenGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerApiTokenGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerApiTokenGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterApiTokenDto) {
		return await super.getByFilters(dto);
	}
}
