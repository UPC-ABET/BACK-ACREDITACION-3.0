import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCommissionController,
	SwaggerCommissionCreate,
	SwaggerCommissionUpdate,
	SwaggerCommissionDelete,
	SwaggerCommissionGetAll,
	SwaggerCommissionGetById,
	SwaggerCommissionGetByFilters,
} from './docs/commissions.swagger';
import { CommissionService } from './commissions.service';
import {
	CreateCommissionDto,
	UpdateCommissionDto,
	FilterCommissionDto,
} from '../model/commissions.dtos';

@SwaggerCommissionController()
export class CommissionController extends BaseController<CommissionService> {
	constructor(private readonly service: CommissionService) {
		super(service);
	}

	@SwaggerCommissionCreate()
	async create(@Body() dto: CreateCommissionDto) {
		return await super.create(dto);
	}

	@SwaggerCommissionUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCommissionDto) {
		return await super.update(id, dto);
	}

	@SwaggerCommissionDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCommissionGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCommissionGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCommissionGetByFilters()
	async getByFilters(@Body() dto: FilterCommissionDto) {
		return await super.getByFilters(dto);
	}
}
