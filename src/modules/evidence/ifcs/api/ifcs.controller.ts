import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { SwaggerIfcController, SwaggerIfcCreate, SwaggerIfcUpdate, SwaggerIfcDelete, SwaggerIfcGetAll, SwaggerIfcGetById, SwaggerIfcGetByFilters, SwaggerIfcList } from './docs/ifcs.swagger';
import { IfcService } from './ifcs.service';
import { CreateIfcDto, UpdateIfcDto, FilterIfcDto, ListIfcsDto } from '../model/ifcs.dtos';

@SwaggerIfcController()
export class IfcController extends BaseController<IfcService> {
	constructor(private readonly service: IfcService) {
		super(service);
	}

	@SwaggerIfcCreate()
	async create(@Body() dto: CreateIfcDto) {
		return await super.create(dto);
	}

	@SwaggerIfcUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateIfcDto) {
		return await super.update(id, dto);
	}

	@SwaggerIfcDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerIfcGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerIfcGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerIfcGetByFilters()
	async getByFilters(@Body() dto: FilterIfcDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerIfcList()
	async list(@Body() dto: ListIfcsDto) {
		return parseSuccessResponse(await this.service.list(dto));
	}
}
