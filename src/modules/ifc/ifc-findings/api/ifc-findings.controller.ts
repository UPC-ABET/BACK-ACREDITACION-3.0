import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerIfcFindingController,
	SwaggerIfcFindingCreate,
	SwaggerIfcFindingUpdate,
	SwaggerIfcFindingDelete,
	SwaggerIfcFindingGetAll,
	SwaggerIfcFindingGetById,
	SwaggerIfcFindingGetByFilters,
} from './docs/ifc-findings.swagger';
import { IfcFindingService } from './ifc-findings.service';
import { CreateIfcFindingDto, UpdateIfcFindingDto, FilterIfcFindingDto } from '../model/ifc-findings.dtos';

@SwaggerIfcFindingController()
export class IfcFindingController extends BaseController<IfcFindingService> {
	constructor(private readonly service: IfcFindingService) {
		super(service);
	}

	@SwaggerIfcFindingCreate()
	async create(@Body() dto: CreateIfcFindingDto) {
		return await super.create(dto);
	}

	@SwaggerIfcFindingUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateIfcFindingDto) {
		return await super.update(id, dto);
	}

	@SwaggerIfcFindingDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerIfcFindingGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerIfcFindingGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerIfcFindingGetByFilters()
	async getByFilters(@Body() dto: FilterIfcFindingDto) {
		return await super.getByFilters(dto);
	}
}
