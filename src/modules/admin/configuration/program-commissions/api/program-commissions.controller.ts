import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { ProgramCommissionService } from 'src/modules/accreditation/program-commissions/api/program-commissions.service';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

import { AssociateProgramCommissionDto } from '../model/program-commissions.dtos';
import {
	SwaggerProgramCommissionsController,
	SwaggerProgramCommissionsAssociate,
	SwaggerProgramCommissionsUnassociate,
	SwaggerProgramCommissionsList,
} from './docs/program-commissions.swagger';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProgramCommissionsController()
export class ProgramCommissionsController {
	constructor(private readonly service: ProgramCommissionService) {}

	@SwaggerProgramCommissionsAssociate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async associate(@Body() dto: AssociateProgramCommissionDto) {
		return parseSuccessResponse(await this.service.associate(dto), HttpStatus.CREATED);
	}

	@SwaggerProgramCommissionsUnassociate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.DELETE })
	async unassociate(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.unassociate(id));
	}

	@SwaggerProgramCommissionsList()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async list(@AcademicPeriodId() academicPeriodId: number) {
		return parseSuccessResponse(await this.service.listByPeriod(academicPeriodId));
	}
}
