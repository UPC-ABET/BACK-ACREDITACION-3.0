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
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerPeriodsController()
export class PeriodsController {
	constructor(private readonly service: AcademicPeriodService) {}

	@SwaggerPeriodsCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreatePeriodDto) {
		return parseSuccessResponse(await this.service.openPeriod(dto), HttpStatus.CREATED);
	}

	@SwaggerPeriodsActivate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PATCH })
	async activate(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.activatePeriod(id));
	}

	@SwaggerPeriodsList()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async list() {
		return parseSuccessResponse(await this.service.listAllPeriods());
	}

	@SwaggerPeriodsFind()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async find(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.getById(id));
	}
}
