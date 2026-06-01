import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudyPlanController,
	SwaggerStudyPlanCreate,
	SwaggerStudyPlanUpdate,
	SwaggerStudyPlanDelete,
	SwaggerStudyPlanGetAll,
	SwaggerStudyPlanGetById,
	SwaggerStudyPlanGetByFilters,
} from './docs/study-plans.swagger';
import { StudyPlanService } from './study-plans.service';
import {
	CreateStudyPlanDto,
	UpdateStudyPlanDto,
	FilterStudyPlanDto,
} from '../model/study-plans.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerStudyPlanController()
export class StudyPlanController extends BaseController<StudyPlanService> {
	constructor(private readonly service: StudyPlanService) {
		super(service);
	}

	@SwaggerStudyPlanCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateStudyPlanDto) {
		return await super.create(dto);
	}

	@SwaggerStudyPlanUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudyPlanDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudyPlanDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudyPlanGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterStudyPlanDto) {
		return await super.getByFilters(dto);
	}
}
