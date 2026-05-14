import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudentController,
	SwaggerStudentCreate,
	SwaggerStudentUpdate,
	SwaggerStudentDelete,
	SwaggerStudentGetAll,
	SwaggerStudentGetById,
	SwaggerStudentGetByFilters,
} from './docs/students.swagger';
import { StudentService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, FilterStudentDto } from '../model/students.dtos';

@SwaggerStudentController()
export class StudentController extends BaseController<StudentService> {
	constructor(private readonly service: StudentService) {
		super(service);
	}

	@SwaggerStudentCreate()
	async create(@Body() dto: CreateStudentDto) {
		return await super.create(dto);
	}

	@SwaggerStudentUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateStudentDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudentDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentGetByFilters()
	async getByFilters(@Body() dto: FilterStudentDto) {
		return await super.getByFilters(dto);
	}
}
