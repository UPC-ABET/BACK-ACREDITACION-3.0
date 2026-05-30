import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';

import { ProgramCommissionsService } from './program-commissions.service';
import { CreateProgramCommissionDto } from '../model/program-commissions.dtos';
import {
	SwaggerProgramCommissionsController,
	SwaggerProgramCommissionsAssociate,
	SwaggerProgramCommissionsUnassociate,
	SwaggerProgramCommissionsList,
} from './docs/program-commissions.swagger';

// Phase 0 — Career ↔ Commission association (blueprint §2 FASE_0 node C + §3.1 CarreraComision).
@SwaggerProgramCommissionsController()
export class ProgramCommissionsController {
	constructor(private readonly service: ProgramCommissionsService) {}

	@SwaggerProgramCommissionsAssociate()
	async associate(
		@Param('periodId', ParseIntPipe) periodId: number,
		@Body() dto: CreateProgramCommissionDto,
	) {
		return parseSuccessResponse(
			await this.service.associate(periodId, dto.program_id, dto.commission_id),
			HttpStatus.CREATED,
		);
	}

	@SwaggerProgramCommissionsUnassociate()
	async unassociate(
		@Param('periodId', ParseIntPipe) periodId: number,
		@Param('id', ParseIntPipe) id: number,
	) {
		return parseSuccessResponse(await this.service.unassociate(periodId, id));
	}

	@SwaggerProgramCommissionsList()
	async list(@Param('periodId', ParseIntPipe) periodId: number) {
		return parseSuccessResponse(await this.service.listByPeriod(periodId));
	}
}
