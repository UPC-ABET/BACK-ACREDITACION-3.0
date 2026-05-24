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

@SwaggerSchoolController()
export class SchoolController extends BaseController<SchoolService> {
	constructor(private readonly service: SchoolService) {
		super(service);
	}

	@SwaggerSchoolCreate()
	async create(@Body() dto: CreateSchoolDto) {
		return await super.create(dto);
	}

	@SwaggerSchoolUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSchoolDto) {
		return await super.update(id, dto);
	}

	@SwaggerSchoolDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerSchoolGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerSchoolGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerSchoolGetByFilters()
	async getByFilters(@Body() dto: FilterSchoolDto) {
		return await super.getByFilters(dto);
	}
}
