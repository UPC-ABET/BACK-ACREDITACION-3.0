import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCampusController,
	SwaggerCampusCreate,
	SwaggerCampusUpdate,
	SwaggerCampusDelete,
	SwaggerCampusGetAll,
	SwaggerCampusGetById,
	SwaggerCampusGetByFilters,
} from './docs/campuses.swagger';
import { CampusService } from './campuses.service';
import { CreateCampusDto, UpdateCampusDto, FilterCampusDto } from '../model/campuses.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerCampusController()
export class CampusController extends BaseController<CampusService> {
	constructor(private readonly service: CampusService) {
		super(service);
	}

	@SwaggerCampusCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateCampusDto) {
		return await super.create(dto);
	}

	@SwaggerCampusUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampusDto) {
		return await super.update(id, dto);
	}

	@SwaggerCampusDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCampusGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCampusGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCampusGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterCampusDto) {
		return await super.getByFilters(dto);
	}
}
