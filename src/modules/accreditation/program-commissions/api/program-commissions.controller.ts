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

@SwaggerProgramCommissionController()
export class ProgramCommissionController extends BaseController<ProgramCommissionService> {
	constructor(private readonly service: ProgramCommissionService) {
		super(service);
	}

	@SwaggerProgramCommissionGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProgramCommissionGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProgramCommissionGetByFilters()
	async getByFilters(@Body() dto: FilterProgramCommissionDto) {
		return await super.getByFilters(dto);
	}
}
