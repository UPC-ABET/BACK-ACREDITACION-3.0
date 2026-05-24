import { Body, Param } from '@nestjs/common';
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

@SwaggerStudyPlanController()
export class StudyPlanController extends BaseController<StudyPlanService> {
	constructor(private readonly service: StudyPlanService) {
		super(service);
	}

	@SwaggerStudyPlanCreate()
	async create(@Body() dto: CreateStudyPlanDto) {
		return await super.create(dto);
	}

	@SwaggerStudyPlanUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateStudyPlanDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudyPlanDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerStudyPlanGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanGetByFilters()
	async getByFilters(@Body() dto: FilterStudyPlanDto) {
		return await super.getByFilters(dto);
	}
}
