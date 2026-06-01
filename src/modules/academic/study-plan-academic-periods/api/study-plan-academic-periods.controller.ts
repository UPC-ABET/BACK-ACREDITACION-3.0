import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudyPlanAcademicPeriodController,
	SwaggerStudyPlanAcademicPeriodGetAll,
	SwaggerStudyPlanAcademicPeriodGetById,
	SwaggerStudyPlanAcademicPeriodGetByFilters,
} from './docs/study-plan-academic-periods.swagger';
import { StudyPlanAcademicPeriodService } from './study-plan-academic-periods.service';
import { FilterStudyPlanAcademicPeriodDto } from '../model/study-plan-academic-periods.dtos';

@SwaggerStudyPlanAcademicPeriodController()
export class StudyPlanAcademicPeriodController extends BaseController<StudyPlanAcademicPeriodService> {
	constructor(private readonly service: StudyPlanAcademicPeriodService) {
		super(service);
	}

	@SwaggerStudyPlanAcademicPeriodGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanAcademicPeriodGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanAcademicPeriodGetByFilters()
	async getByFilters(@Body() dto: FilterStudyPlanAcademicPeriodDto) {
		return await super.getByFilters(dto);
	}
}
