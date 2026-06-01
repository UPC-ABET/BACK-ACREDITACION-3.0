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

const ORGANIZATION_MODULE = 'ORGANIZATION';

@SwaggerSchoolController()
export class SchoolController extends BaseController<SchoolService> {
	constructor(private readonly service: SchoolService) {
		super(service);
	}

	@SwaggerSchoolCreate()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async create(@Body() dto: CreateSchoolDto) {
		return await super.create(dto);
	}

	@SwaggerSchoolUpdate()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSchoolDto) {
		return await super.update(id, dto);
	}

	@SwaggerSchoolDelete()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerSchoolGetAll()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerSchoolGetById()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerSchoolGetByFilters()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterSchoolDto) {
		return await super.getByFilters(dto);
	}
}
