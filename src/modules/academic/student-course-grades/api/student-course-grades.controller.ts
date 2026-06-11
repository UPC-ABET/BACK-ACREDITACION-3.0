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
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerStudentCourseGradeController()
export class StudentCourseGradeController extends BaseController<StudentCourseGradeService> {
	constructor(private readonly service: StudentCourseGradeService) {
		super(service);
	}

	@SwaggerStudentCourseGradeCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateStudentCourseGradeDto) {
		return await super.create(dto);
	}

	@SwaggerStudentCourseGradeUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentCourseGradeDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudentCourseGradeDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentCourseGradeGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentCourseGradeGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentCourseGradeGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterStudentCourseGradeDto) {
		return await super.getByFilters(dto);
	}
}
