import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProgramCommissionController,
	SwaggerProgramCommissionGetAll,
	SwaggerProgramCommissionGetById,
	SwaggerProgramCommissionGetByFilters,
} from './docs/program-commissions.swagger';
import { ProgramCommissionService } from './program-commissions.service';
import { FilterProgramCommissionDto } from '../model/program-commissions.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProgramCommissionController()
export class ProgramCommissionController extends BaseController<ProgramCommissionService> {
	constructor(private readonly service: ProgramCommissionService) {
		super(service);
	}

	@SwaggerProgramCommissionGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProgramCommissionGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProgramCommissionGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterProgramCommissionDto) {
		return await super.getByFilters(dto);
	}
}
