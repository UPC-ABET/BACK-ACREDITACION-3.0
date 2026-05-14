import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerEnrolledStudentController,
	SwaggerEnrolledStudentCreate,
	SwaggerEnrolledStudentUpdate,
	SwaggerEnrolledStudentDelete,
	SwaggerEnrolledStudentGetAll,
	SwaggerEnrolledStudentGetById,
	SwaggerEnrolledStudentGetByFilters,
} from './docs/enrolled-students.swagger';
import { EnrolledStudentService } from './enrolled-students.service';
import { CreateEnrolledStudentDto, UpdateEnrolledStudentDto, FilterEnrolledStudentDto } from '../model/enrolled-students.dtos';

@SwaggerEnrolledStudentController()
export class EnrolledStudentController extends BaseController<EnrolledStudentService> {
	constructor(private readonly service: EnrolledStudentService) {
		super(service);
	}

	@SwaggerEnrolledStudentCreate()
	async create(@Body() dto: CreateEnrolledStudentDto) {
		return await super.create(dto);
	}

	@SwaggerEnrolledStudentUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateEnrolledStudentDto) {
		return await super.update(id, dto);
	}

	@SwaggerEnrolledStudentDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerEnrolledStudentGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerEnrolledStudentGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerEnrolledStudentGetByFilters()
	async getByFilters(@Body() dto: FilterEnrolledStudentDto) {
		return await super.getByFilters(dto);
	}
}
