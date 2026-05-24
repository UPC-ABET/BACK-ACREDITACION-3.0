import { Body, Param } from '@nestjs/common';
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

@SwaggerStaffController()
export class StaffController extends BaseController<StaffService> {
	constructor(private readonly service: StaffService) {
		super(service);
	}

	@SwaggerStaffCreate()
	async create(@Body() dto: CreateStaffDto) {
		return await super.create(dto);
	}

	@SwaggerStaffUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateStaffDto) {
		return await super.update(id, dto);
	}

	@SwaggerStaffDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerStaffGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStaffGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerStaffGetByFilters()
	async getByFilters(@Body() dto: FilterStaffDto) {
		return await super.getByFilters(dto);
	}
}
