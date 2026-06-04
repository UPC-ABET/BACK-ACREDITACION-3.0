import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	SwaggerUserRoleController,
	SwaggerUserRoleCreate,
	SwaggerUserRoleUpdate,
	SwaggerUserRoleDelete,
	SwaggerUserRoleGetAll,
	SwaggerUserRoleGetById,
	SwaggerUserRoleGetByFilters,
} from './docs/user-roles.swagger';
import { UserRoleService } from './user-roles.service';
import {
	CreateUserRoleDto,
	UpdateUserRoleDto,
	FilterUserRoleDto,
} from '../model/user-roles.dtos';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerUserRoleController()
export class UserRoleController extends BaseController<UserRoleService> {
	constructor(private readonly service: UserRoleService) {
		super(service);
	}

	@SwaggerUserRoleCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateUserRoleDto) {
		return await super.create(dto);
	}

	@SwaggerUserRoleUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserRoleDto) {
		return await super.update(id, dto);
	}

	@SwaggerUserRoleDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerUserRoleGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerUserRoleGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerUserRoleGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterUserRoleDto) {
		return await super.getByFilters(dto);
	}
}
