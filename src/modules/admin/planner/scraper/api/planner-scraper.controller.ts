import { Body, HttpStatus, Param } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { PlannerScraperService } from './planner-scraper.service';
import { RunPlannerScrapeDto } from '../model/planner-scraper.dtos';
import {
	SwaggerPlannerScraperController,
	SwaggerPlannerScraperGetRun,
	SwaggerPlannerScraperList,
	SwaggerPlannerScraperRun,
} from './docs/planner-scraper.swagger';

@SwaggerPlannerScraperController()
export class PlannerScraperController {
	constructor(private readonly service: PlannerScraperService) {}

	@SwaggerPlannerScraperRun()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.POST })
	async run(
		@AcademicPeriodId() academicPeriodId: number,
		@Body() dto: RunPlannerScrapeDto,
		@CurrentUser() user: RequestUser,
	) {
		return parseSuccessResponse(
			await this.service.run(academicPeriodId, dto, `user:${user.userId}`),
			HttpStatus.CREATED,
		);
	}

	@SwaggerPlannerScraperList()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async list(@AcademicPeriodId() academicPeriodId: number) {
		return parseSuccessResponse(await this.service.listRuns(academicPeriodId));
	}

	@SwaggerPlannerScraperGetRun()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async getRun(@Param('runId') runId: string) {
		return parseSuccessResponse(await this.service.getRun(runId));
	}
}
