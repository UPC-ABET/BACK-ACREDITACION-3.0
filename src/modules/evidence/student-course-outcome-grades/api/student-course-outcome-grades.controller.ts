import { Body, Param, ParseIntPipe } from '@nestjs/common';
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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerStudentCourseOutcomeGradeController()
export class StudentCourseOutcomeGradeController extends BaseController<StudentCourseOutcomeGradeService> {
	constructor(private readonly service: StudentCourseOutcomeGradeService) {
		super(service);
	}

	@SwaggerStudentCourseOutcomeGradeCreate()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateStudentCourseOutcomeGradeDto) {
		return await super.create(dto);
	}

	@SwaggerStudentCourseOutcomeGradeUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.PUT })
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateStudentCourseOutcomeGradeDto,
	) {
		return await super.update(id, dto);
	}

	@SwaggerStudentCourseOutcomeGradeDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentCourseOutcomeGradeGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentCourseOutcomeGradeGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentCourseOutcomeGradeGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterStudentCourseOutcomeGradeDto) {
		return await super.getByFilters(dto);
	}
}
