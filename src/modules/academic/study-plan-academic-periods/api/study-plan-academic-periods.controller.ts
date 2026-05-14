import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudyPlanAcademicPeriodController,
	SwaggerStudyPlanAcademicPeriodCreate,
	SwaggerStudyPlanAcademicPeriodUpdate,
	SwaggerStudyPlanAcademicPeriodDelete,
	SwaggerStudyPlanAcademicPeriodGetAll,
	SwaggerStudyPlanAcademicPeriodGetById,
	SwaggerStudyPlanAcademicPeriodGetByFilters,
} from './docs/study-plan-academic-periods.swagger';
import { StudyPlanAcademicPeriodService } from './study-plan-academic-periods.service';
import { CreateStudyPlanAcademicPeriodDto, UpdateStudyPlanAcademicPeriodDto, FilterStudyPlanAcademicPeriodDto } from '../model/study-plan-academic-periods.dtos';

@SwaggerStudyPlanAcademicPeriodController()
export class StudyPlanAcademicPeriodController extends BaseController<StudyPlanAcademicPeriodService> {
	constructor(private readonly service: StudyPlanAcademicPeriodService) {
		super(service);
	}

	@SwaggerStudyPlanAcademicPeriodCreate()
	async create(@Body() dto: CreateStudyPlanAcademicPeriodDto) {
		return await super.create(dto);
	}

	@SwaggerStudyPlanAcademicPeriodUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateStudyPlanAcademicPeriodDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudyPlanAcademicPeriodDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerStudyPlanAcademicPeriodGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanAcademicPeriodGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanAcademicPeriodGetByFilters()
	async getByFilters(@Body() dto: FilterStudyPlanAcademicPeriodDto) {
		return await super.getByFilters(dto);
	}
}
