import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerSchoolController,
	SwaggerSchoolCreate,
	SwaggerSchoolUpdate,
	SwaggerSchoolDelete,
	SwaggerSchoolGetAll,
	SwaggerSchoolGetById,
	SwaggerSchoolGetByFilters,
} from './docs/schools.swagger';
import { SchoolService } from './schools.service';
import { CreateSchoolDto, UpdateSchoolDto, FilterSchoolDto } from '../model/schools.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerSchoolController()
export class SchoolController extends BaseController<SchoolService> {
	constructor(private readonly service: SchoolService) {
		super(service);
	}

	@SwaggerSchoolCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateSchoolDto) {
		return await super.create(dto);
	}

	@SwaggerSchoolUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSchoolDto) {
		return await super.update(id, dto);
	}

	@SwaggerSchoolDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerSchoolGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerSchoolGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerSchoolGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterSchoolDto) {
		return await super.getByFilters(dto);
	}
}
