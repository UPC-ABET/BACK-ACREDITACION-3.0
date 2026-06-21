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
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerStudyPlanAcademicPeriodController()
export class StudyPlanAcademicPeriodController extends BaseController<StudyPlanAcademicPeriodService> {
	constructor(private readonly service: StudyPlanAcademicPeriodService) {
		super(service);
	}

	@SwaggerStudyPlanAcademicPeriodGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanAcademicPeriodGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanAcademicPeriodGetByFilters()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(
		@Body() dto: FilterStudyPlanAcademicPeriodDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return await super.getByFilters(academicPeriodId == null ? dto : { ...dto, academicPeriodId });
	}
}
