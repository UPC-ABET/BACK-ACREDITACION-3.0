import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	SwaggerRoleModulePermissionController,
	SwaggerRoleModulePermissionCreate,
	SwaggerRoleModulePermissionUpdate,
	SwaggerRoleModulePermissionDelete,
	SwaggerRoleModulePermissionGetAll,
	SwaggerRoleModulePermissionGetById,
	SwaggerRoleModulePermissionGetByFilters,
} from './docs/role-module-permissions.swagger';
import { RoleModulePermissionService } from './role-module-permissions.service';
import {
	CreateRoleModulePermissionDto,
	UpdateRoleModulePermissionDto,
	FilterRoleModulePermissionDto,
} from '../model/role-module-permissions.dtos';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerRoleModulePermissionController()
export class RoleModulePermissionController extends BaseController<RoleModulePermissionService> {
	constructor(private readonly service: RoleModulePermissionService) {
		super(service);
	}

	@SwaggerRoleModulePermissionCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateRoleModulePermissionDto) {
		return await super.create(dto);
	}

	@SwaggerRoleModulePermissionUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleModulePermissionDto) {
		return await super.update(id, dto);
	}

	@SwaggerRoleModulePermissionDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerRoleModulePermissionGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerRoleModulePermissionGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerRoleModulePermissionGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterRoleModulePermissionDto) {
		return await super.getByFilters(dto);
	}
}
