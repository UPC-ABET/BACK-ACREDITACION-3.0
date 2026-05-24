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

@SwaggerFacultyController()
export class FacultyController extends BaseController<FacultyService> {
	constructor(private readonly service: FacultyService) {
		super(service);
	}

	@SwaggerFacultyCreate()
	async create(@Body() dto: CreateFacultyDto) {
		return await super.create(dto);
	}

	@SwaggerFacultyUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFacultyDto) {
		return await super.update(id, dto);
	}

	@SwaggerFacultyDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerFacultyGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFacultyGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerFacultyGetByFilters()
	async getByFilters(@Body() dto: FilterFacultyDto) {
		return await super.getByFilters(dto);
	}
}
