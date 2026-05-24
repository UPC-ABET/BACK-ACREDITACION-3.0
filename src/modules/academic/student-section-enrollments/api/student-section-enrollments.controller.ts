import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudentSectionEnrollmentController,
	SwaggerStudentSectionEnrollmentCreate,
	SwaggerStudentSectionEnrollmentUpdate,
	SwaggerStudentSectionEnrollmentDelete,
	SwaggerStudentSectionEnrollmentGetAll,
	SwaggerStudentSectionEnrollmentGetById,
	SwaggerStudentSectionEnrollmentGetByFilters,
} from './docs/student-section-enrollments.swagger';
import { StudentSectionEnrollmentService } from './student-section-enrollments.service';
import {
	CreateStudentSectionEnrollmentDto,
	UpdateStudentSectionEnrollmentDto,
	FilterStudentSectionEnrollmentDto,
} from '../model/student-section-enrollments.dtos';

@SwaggerStudentSectionEnrollmentController()
export class StudentSectionEnrollmentController extends BaseController<StudentSectionEnrollmentService> {
	constructor(private readonly service: StudentSectionEnrollmentService) {
		super(service);
	}

	@SwaggerStudentSectionEnrollmentCreate()
	async create(@Body() dto: CreateStudentSectionEnrollmentDto) {
		return await super.create(dto);
	}

	@SwaggerStudentSectionEnrollmentUpdate()
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateStudentSectionEnrollmentDto,
	) {
		return await super.update(id, dto);
	}

	@SwaggerStudentSectionEnrollmentDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentSectionEnrollmentGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentSectionEnrollmentGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentSectionEnrollmentGetByFilters()
	async getByFilters(@Body() dto: FilterStudentSectionEnrollmentDto) {
		return await super.getByFilters(dto);
	}
}
