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
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerFacultyController()
export class FacultyController extends BaseController<FacultyService> {
	constructor(private readonly service: FacultyService) {
		super(service);
	}

	@SwaggerFacultyCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateFacultyDto) {
		return await super.create(dto);
	}

	@SwaggerFacultyUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFacultyDto) {
		return await super.update(id, dto);
	}

	@SwaggerFacultyDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerFacultyGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFacultyGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerFacultyGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterFacultyDto) {
		return await super.getByFilters(dto);
	}
}
