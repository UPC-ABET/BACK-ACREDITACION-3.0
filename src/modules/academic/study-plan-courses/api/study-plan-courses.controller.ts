import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudyPlanCourseController,
	SwaggerStudyPlanCourseCreate,
	SwaggerStudyPlanCourseUpdate,
	SwaggerStudyPlanCourseDelete,
	SwaggerStudyPlanCourseGetAll,
	SwaggerStudyPlanCourseGetById,
	SwaggerStudyPlanCourseGetByFilters,
} from './docs/study-plan-courses.swagger';
import { StudyPlanCourseService } from './study-plan-courses.service';
import {
	CreateStudyPlanCourseDto,
	UpdateStudyPlanCourseDto,
	FilterStudyPlanCourseDto,
} from '../model/study-plan-courses.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerStudyPlanCourseController()
export class StudyPlanCourseController extends BaseController<StudyPlanCourseService> {
	constructor(private readonly service: StudyPlanCourseService) {
		super(service);
	}

	@SwaggerStudyPlanCourseCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateStudyPlanCourseDto) {
		return await super.create(dto);
	}

	@SwaggerStudyPlanCourseUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudyPlanCourseDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudyPlanCourseDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudyPlanCourseGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanCourseGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanCourseGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterStudyPlanCourseDto) {
		return await super.getByFilters(dto);
	}
}
