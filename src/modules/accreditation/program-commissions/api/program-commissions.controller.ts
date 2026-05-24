import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProgramCommissionController,
	SwaggerProgramCommissionCreate,
	SwaggerProgramCommissionUpdate,
	SwaggerProgramCommissionDelete,
	SwaggerProgramCommissionGetAll,
	SwaggerProgramCommissionGetById,
	SwaggerProgramCommissionGetByFilters,
} from './docs/program-commissions.swagger';
import { ProgramCommissionService } from './program-commissions.service';
import {
	CreateProgramCommissionDto,
	UpdateProgramCommissionDto,
	FilterProgramCommissionDto,
} from '../model/program-commissions.dtos';

@SwaggerProgramCommissionController()
export class ProgramCommissionController extends BaseController<ProgramCommissionService> {
	constructor(private readonly service: ProgramCommissionService) {
		super(service);
	}

	@SwaggerProgramCommissionCreate()
	async create(@Body() dto: CreateProgramCommissionDto) {
		return await super.create(dto);
	}

	@SwaggerProgramCommissionUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProgramCommissionDto) {
		return await super.update(id, dto);
	}

	@SwaggerProgramCommissionDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
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
