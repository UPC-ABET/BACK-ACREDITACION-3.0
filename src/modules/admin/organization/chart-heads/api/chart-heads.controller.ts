import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

import {
	SwaggerChartHeadsController,
	SwaggerChartHeadsConfigure,
	SwaggerChartHeadsGetByPeriod,
} from './docs/chart-heads.swagger';
import { ChartHeadsService } from './chart-heads.service';
import { ConfigureChartHeadsDto } from '../model/chart-heads.dtos';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerChartHeadsController()
export class ChartHeadsController {
	constructor(private readonly service: ChartHeadsService) {}

	@SwaggerChartHeadsConfigure()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async configure(@Body() dto: ConfigureChartHeadsDto) {
		return parseSuccessResponse(await this.service.configure(dto));
	}

	@SwaggerChartHeadsGetByPeriod()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getByPeriod(@Param('academicPeriodId', ParseIntPipe) academicPeriodId: number) {
		return parseSuccessResponse(await this.service.getConfiguration(academicPeriodId));
	}
}
