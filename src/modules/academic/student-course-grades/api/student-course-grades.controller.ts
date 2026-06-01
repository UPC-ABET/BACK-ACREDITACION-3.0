import { Body, Param, ParseIntPipe } from '@nestjs/common';
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
import {
	CreateStudentCourseGradeDto,
	UpdateStudentCourseGradeDto,
	FilterStudentCourseGradeDto,
} from '../model/student-course-grades.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerStudentCourseGradeController()
export class StudentCourseGradeController extends BaseController<StudentCourseGradeService> {
	constructor(private readonly service: StudentCourseGradeService) {
		super(service);
	}

	@SwaggerStudentCourseGradeCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateStudentCourseGradeDto) {
		return await super.create(dto);
	}

	@SwaggerStudentCourseGradeUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentCourseGradeDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudentCourseGradeDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentCourseGradeGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentCourseGradeGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentCourseGradeGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterStudentCourseGradeDto) {
		return await super.getByFilters(dto);
	}
}
