import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';

import { PeriodsService } from './periods.service';
import { CreatePeriodDto } from '../model/periods.dtos';
import {
	SwaggerPeriodsController,
	SwaggerPeriodsCreate,
	SwaggerPeriodsList,
	SwaggerPeriodsFind,
	SwaggerPeriodsClose,
} from './docs/periods.swagger';

// Phase 0 — Academic period opening (blueprint §2 FASE_0).
@SwaggerPeriodsController()
export class PeriodsController {
	constructor(private readonly service: PeriodsService) {}

	@SwaggerPeriodsCreate()
	async create(@Body() dto: CreatePeriodDto) {
		return parseSuccessResponse(await this.service.createPeriod(dto), HttpStatus.CREATED);
	}

	@SwaggerPeriodsList()
	async list() {
		return parseSuccessResponse(await this.service.listPeriods());
	}

	@SwaggerPeriodsFind()
	async find(@Param('periodId', ParseIntPipe) periodId: number) {
		return parseSuccessResponse(await this.service.findPeriod(periodId));
	}

	// Period close (soft-close: status=INA + is_active=false).
	@SwaggerPeriodsClose()
	async close(@Param('periodId', ParseIntPipe) periodId: number) {
		return parseSuccessResponse(await this.service.deletePeriod(periodId));
	}
}
