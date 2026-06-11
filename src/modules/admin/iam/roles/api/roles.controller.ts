import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	SwaggerRoleController,
	SwaggerRoleCreate,
	SwaggerRoleUpdate,
	SwaggerRoleDelete,
	SwaggerRoleGetAll,
	SwaggerRoleGetById,
	SwaggerRoleGetByFilters,
} from './docs/roles.swagger';
import { RoleService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto, FilterRoleDto } from '../model/roles.dtos';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerRoleController()
export class RoleController extends BaseController<RoleService> {
	constructor(private readonly service: RoleService) {
		super(service);
	}

	@SwaggerRoleCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateRoleDto) {
		return await super.create(dto);
	}

	@SwaggerRoleUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
		return await super.update(id, dto);
	}

	@SwaggerRoleDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerRoleGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerRoleGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerRoleGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterRoleDto) {
		return await super.getByFilters(dto);
	}
}
