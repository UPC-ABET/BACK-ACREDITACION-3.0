import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudentCourseOutcomeGradeController,
	SwaggerStudentCourseOutcomeGradeCreate,
	SwaggerStudentCourseOutcomeGradeUpdate,
	SwaggerStudentCourseOutcomeGradeDelete,
	SwaggerStudentCourseOutcomeGradeGetAll,
	SwaggerStudentCourseOutcomeGradeGetById,
	SwaggerStudentCourseOutcomeGradeGetByFilters,
} from './docs/student-course-outcome-grades.swagger';
import { StudentCourseOutcomeGradeService } from './student-course-outcome-grades.service';
import {
	CreateStudentCourseOutcomeGradeDto,
	UpdateStudentCourseOutcomeGradeDto,
	FilterStudentCourseOutcomeGradeDto,
} from '../model/student-course-outcome-grades.dtos';

@SwaggerStudentCourseOutcomeGradeController()
export class StudentCourseOutcomeGradeController extends BaseController<StudentCourseOutcomeGradeService> {
	constructor(private readonly service: StudentCourseOutcomeGradeService) {
		super(service);
	}

	@SwaggerStudentCourseOutcomeGradeCreate()
	async create(@Body() dto: CreateStudentCourseOutcomeGradeDto) {
		return await super.create(dto);
	}

	@SwaggerStudentCourseOutcomeGradeUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateStudentCourseOutcomeGradeDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudentCourseOutcomeGradeDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentCourseOutcomeGradeGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentCourseOutcomeGradeGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentCourseOutcomeGradeGetByFilters()
	async getByFilters(@Body() dto: FilterStudentCourseOutcomeGradeDto) {
		return await super.getByFilters(dto);
	}
}
