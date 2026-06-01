import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerFacultyController,
	SwaggerFacultyCreate,
	SwaggerFacultyUpdate,
	SwaggerFacultyDelete,
	SwaggerFacultyGetAll,
	SwaggerFacultyGetById,
	SwaggerFacultyGetByFilters,
} from './docs/faculties.swagger';
import { FacultyService } from './faculties.service';
import { CreateFacultyDto, UpdateFacultyDto, FilterFacultyDto } from '../model/faculties.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ORGANIZATION_MODULE = 'ORGANIZATION';

@SwaggerFacultyController()
export class FacultyController extends BaseController<FacultyService> {
	constructor(private readonly service: FacultyService) {
		super(service);
	}

	@SwaggerFacultyCreate()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async create(@Body() dto: CreateFacultyDto) {
		return await super.create(dto);
	}

	@SwaggerFacultyUpdate()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFacultyDto) {
		return await super.update(id, dto);
	}

	@SwaggerFacultyDelete()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerFacultyGetAll()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFacultyGetById()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerFacultyGetByFilters()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterFacultyDto) {
		return await super.getByFilters(dto);
	}
}
