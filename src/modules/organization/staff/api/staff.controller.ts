import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStaffController,
	SwaggerStaffCreate,
	SwaggerStaffUpdate,
	SwaggerStaffDelete,
	SwaggerStaffGetAll,
	SwaggerStaffGetById,
	SwaggerStaffGetByFilters,
} from './docs/staff.swagger';
import { StaffService } from './staff.service';
import { CreateStaffDto, UpdateStaffDto, FilterStaffDto } from '../model/staff.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ORGANIZATION_MODULE = 'ORGANIZATION';

@SwaggerStaffController()
export class StaffController extends BaseController<StaffService> {
	constructor(private readonly service: StaffService) {
		super(service);
	}

	@SwaggerStaffCreate()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async create(@Body() dto: CreateStaffDto) {
		return await super.create(dto);
	}

	@SwaggerStaffUpdate()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffDto) {
		return await super.update(id, dto);
	}

	@SwaggerStaffDelete()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStaffGetAll()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStaffGetById()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStaffGetByFilters()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterStaffDto) {
		return await super.getByFilters(dto);
	}
}
