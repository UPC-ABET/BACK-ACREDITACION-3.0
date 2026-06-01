import { Body, HttpStatus, Param, ParseIntPipe, Query } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { ProgramCommissionService } from 'src/modules/accreditation/program-commissions/api/program-commissions.service';

import {
	AssociateProgramCommissionDto,
	ListProgramCommissionQueryDto,
} from '../model/program-commissions.dtos';
import {
	SwaggerProgramCommissionsController,
	SwaggerProgramCommissionsAssociate,
	SwaggerProgramCommissionsUnassociate,
	SwaggerProgramCommissionsList,
} from './docs/program-commissions.swagger';

@SwaggerProgramCommissionsController()
export class ProgramCommissionsController {
	constructor(private readonly service: ProgramCommissionService) {}

	@SwaggerProgramCommissionsAssociate()
	async associate(@Body() dto: AssociateProgramCommissionDto) {
		return parseSuccessResponse(await this.service.associate(dto), HttpStatus.CREATED);
	}

	@SwaggerProgramCommissionsUnassociate()
	async unassociate(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.unassociate(id));
	}

	@SwaggerProgramCommissionsList()
	async list(@Query() query: ListProgramCommissionQueryDto) {
		return parseSuccessResponse(await this.service.listByPeriod(query.academicPeriodId));
	}
}
