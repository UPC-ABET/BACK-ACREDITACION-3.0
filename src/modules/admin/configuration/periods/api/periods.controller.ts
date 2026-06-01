import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { AcademicPeriodService } from 'src/modules/academic/academic-periods/api/academic-periods.service';

import { CreatePeriodDto } from '../model/periods.dtos';
import {
	SwaggerPeriodsController,
	SwaggerPeriodsCreate,
	SwaggerPeriodsActivate,
	SwaggerPeriodsList,
	SwaggerPeriodsFind,
} from './docs/periods.swagger';

@SwaggerPeriodsController()
export class PeriodsController {
	constructor(private readonly service: AcademicPeriodService) {}

	@SwaggerPeriodsCreate()
	async create(@Body() dto: CreatePeriodDto) {
		return parseSuccessResponse(await this.service.openPeriod(dto), HttpStatus.CREATED);
	}

	@SwaggerPeriodsActivate()
	async activate(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.activatePeriod(id));
	}

	@SwaggerPeriodsList()
	async list() {
		return parseSuccessResponse(await this.service.listAllPeriods());
	}

	@SwaggerPeriodsFind()
	async find(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.getById(id));
	}
}
