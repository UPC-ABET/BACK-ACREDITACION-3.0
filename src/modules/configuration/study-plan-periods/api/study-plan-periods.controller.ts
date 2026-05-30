import { HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';

import { StudyPlanPeriodsService } from './study-plan-periods.service';
import {
	SwaggerStudyPlanPeriodsController,
	SwaggerStudyPlanPeriodsAssociate,
	SwaggerStudyPlanPeriodsUnassociate,
	SwaggerStudyPlanPeriodsList,
} from './docs/study-plan-periods.swagger';

// Phase 0 — Study-plan ↔ period association (blueprint §2 FASE_0 node D + D1).
@SwaggerStudyPlanPeriodsController()
export class StudyPlanPeriodsController {
	constructor(private readonly service: StudyPlanPeriodsService) {}

	@SwaggerStudyPlanPeriodsAssociate()
	async associate(
		@Param('periodId', ParseIntPipe) periodId: number,
		@Param('studyPlanId', ParseIntPipe) studyPlanId: number,
	) {
		return parseSuccessResponse(
			await this.service.associate(periodId, studyPlanId),
			HttpStatus.CREATED,
		);
	}

	@SwaggerStudyPlanPeriodsUnassociate()
	async unassociate(
		@Param('periodId', ParseIntPipe) periodId: number,
		@Param('studyPlanId', ParseIntPipe) studyPlanId: number,
	) {
		return parseSuccessResponse(await this.service.unassociate(periodId, studyPlanId));
	}

	@SwaggerStudyPlanPeriodsList()
	async list(@Param('periodId', ParseIntPipe) periodId: number) {
		return parseSuccessResponse(await this.service.listByPeriod(periodId));
	}
}
