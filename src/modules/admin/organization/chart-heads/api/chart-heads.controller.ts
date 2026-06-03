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

const ADMIN_MODULE = 'ADMIN';

@SwaggerChartHeadsController()
export class ChartHeadsController {
	constructor(private readonly service: ChartHeadsService) {}

	@SwaggerChartHeadsConfigure()
	@RequirePermission({ module: ADMIN_MODULE, action: 'POST' })
	async configure(@Body() dto: ConfigureChartHeadsDto) {
		return parseSuccessResponse(await this.service.configure(dto));
	}

	@SwaggerChartHeadsGetByPeriod()
	@RequirePermission({ module: ADMIN_MODULE, action: 'GET' })
	async getByPeriod(@Param('academicPeriodId', ParseIntPipe) academicPeriodId: number) {
		return parseSuccessResponse(await this.service.getConfiguration(academicPeriodId));
	}
}
