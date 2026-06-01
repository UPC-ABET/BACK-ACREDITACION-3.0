import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { AcademicPeriodService } from 'src/modules/academic/academic-periods/api/academic-periods.service';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

import { CreatePeriodDto } from '../model/periods.dtos';
import {
	SwaggerPeriodsController,
	SwaggerPeriodsCreate,
	SwaggerPeriodsActivate,
	SwaggerPeriodsList,
	SwaggerPeriodsFind,
} from './docs/periods.swagger';

const ADMIN_MODULE = 'ADMIN';

@SwaggerPeriodsController()
export class PeriodsController {
	constructor(private readonly service: AcademicPeriodService) {}

	@SwaggerPeriodsCreate()
	@RequirePermission({ module: ADMIN_MODULE, action: 'POST' })
	async create(@Body() dto: CreatePeriodDto) {
		return parseSuccessResponse(await this.service.openPeriod(dto), HttpStatus.CREATED);
	}

	@SwaggerPeriodsActivate()
	@RequirePermission({ module: ADMIN_MODULE, action: 'PATCH' })
	async activate(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.activatePeriod(id));
	}

	@SwaggerPeriodsList()
	@RequirePermission({ module: ADMIN_MODULE, action: 'GET' })
	async list() {
		return parseSuccessResponse(await this.service.listAllPeriods());
	}

	@SwaggerPeriodsFind()
	@RequirePermission({ module: ADMIN_MODULE, action: 'GET' })
	async find(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.getById(id));
	}
}
