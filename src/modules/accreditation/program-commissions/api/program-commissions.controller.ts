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

const ACCREDITATION_MODULE = 'ACCREDITATION';

@SwaggerProgramCommissionController()
export class ProgramCommissionController extends BaseController<ProgramCommissionService> {
	constructor(private readonly service: ProgramCommissionService) {
		super(service);
	}

	@SwaggerProgramCommissionGetAll()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProgramCommissionGetById()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProgramCommissionGetByFilters()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterProgramCommissionDto) {
		return await super.getByFilters(dto);
	}
}
