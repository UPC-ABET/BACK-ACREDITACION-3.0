import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudentCourseGradeController,
	SwaggerStudentCourseGradeCreate,
	SwaggerStudentCourseGradeUpdate,
	SwaggerStudentCourseGradeDelete,
	SwaggerStudentCourseGradeGetAll,
	SwaggerStudentCourseGradeGetById,
	SwaggerStudentCourseGradeGetByFilters,
} from './docs/student-course-grades.swagger';
import { StudentCourseGradeService } from './student-course-grades.service';
import { CreateStudentCourseGradeDto, UpdateStudentCourseGradeDto, FilterStudentCourseGradeDto } from '../model/student-course-grades.dtos';

@SwaggerStudentCourseGradeController()
export class StudentCourseGradeController extends BaseController<StudentCourseGradeService> {
	constructor(private readonly service: StudentCourseGradeService) {
		super(service);
	}

	@SwaggerStudentCourseGradeCreate()
	async create(@Body() dto: CreateStudentCourseGradeDto) {
		return await super.create(dto);
	}

	@SwaggerStudentCourseGradeUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateStudentCourseGradeDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudentCourseGradeDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentCourseGradeGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentCourseGradeGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentCourseGradeGetByFilters()
	async getByFilters(@Body() dto: FilterStudentCourseGradeDto) {
		return await super.getByFilters(dto);
	}
}
