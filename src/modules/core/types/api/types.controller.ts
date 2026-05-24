import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import {
	SwaggerTypeController,
	SwaggerTypeCreate,
	SwaggerTypeUpdate,
	SwaggerTypeDelete,
	SwaggerTypeGetAll,
	SwaggerTypeGetById,
	SwaggerTypeGetByFilters,
	SwaggerTypesByGroupCode,
} from './docs/types.swagger';
import { TypeService } from './types.service';
import { CreateTypeDto, UpdateTypeDto, FilterTypeDto } from '../model/types.dtos';

@SwaggerTypeController()
export class TypeController extends BaseController<TypeService> {
	constructor(private readonly service: TypeService) {
		super(service);
	}

	@SwaggerTypeCreate()
	async create(@Body() dto: CreateTypeDto) {
		return await super.create(dto);
	}

	@SwaggerTypeUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTypeDto) {
		return await super.update(id, dto);
	}

	@SwaggerTypeDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerTypeGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerTypeGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerTypeGetByFilters()
	async getByFilters(@Body() dto: FilterTypeDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerTypesByGroupCode()
	async byGroupCode(@Param('code') code: string) {
		return parseSuccessResponse(await this.service.findByGroupCode(code));
	}
}
