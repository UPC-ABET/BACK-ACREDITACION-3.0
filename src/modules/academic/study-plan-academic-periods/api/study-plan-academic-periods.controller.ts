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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerStudyPlanAcademicPeriodController()
export class StudyPlanAcademicPeriodController extends BaseController<StudyPlanAcademicPeriodService> {
	constructor(private readonly service: StudyPlanAcademicPeriodService) {
		super(service);
	}

	@SwaggerStudyPlanAcademicPeriodGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanAcademicPeriodGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanAcademicPeriodGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterStudyPlanAcademicPeriodDto) {
		return await super.getByFilters(dto);
	}
}
