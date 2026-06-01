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

const EVIDENCE_MODULE = 'EVIDENCE';

@SwaggerStudentCourseOutcomeGradeController()
export class StudentCourseOutcomeGradeController extends BaseController<StudentCourseOutcomeGradeService> {
	constructor(private readonly service: StudentCourseOutcomeGradeService) {
		super(service);
	}

	@SwaggerStudentCourseOutcomeGradeCreate()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async create(@Body() dto: CreateStudentCourseOutcomeGradeDto) {
		return await super.create(dto);
	}

	@SwaggerStudentCourseOutcomeGradeUpdate()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'PUT' })
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateStudentCourseOutcomeGradeDto,
	) {
		return await super.update(id, dto);
	}

	@SwaggerStudentCourseOutcomeGradeDelete()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentCourseOutcomeGradeGetAll()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentCourseOutcomeGradeGetById()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentCourseOutcomeGradeGetByFilters()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterStudentCourseOutcomeGradeDto) {
		return await super.getByFilters(dto);
	}
}
