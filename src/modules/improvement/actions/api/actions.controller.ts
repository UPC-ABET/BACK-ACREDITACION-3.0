import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerActionController,
	SwaggerActionCreate,
	SwaggerActionUpdate,
	SwaggerActionDelete,
	SwaggerActionGetAll,
	SwaggerActionGetById,
	SwaggerActionGetByFilters,
} from './docs/actions.swagger';
import { ActionService } from './actions.service';
import { CreateActionDto, UpdateActionDto, FilterActionDto } from '../model/actions.dtos';

@SwaggerActionController()
export class ActionController extends BaseController<ActionService> {
	constructor(private readonly service: ActionService) {
		super(service);
	}

	@SwaggerActionCreate()
	async create(@Body() dto: CreateActionDto) {
		return await super.create(dto);
	}

	@SwaggerActionUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateActionDto) {
		return await super.update(id, dto);
	}

	@SwaggerActionDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerActionGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerActionGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerActionGetByFilters()
	async getByFilters(@Body() dto: FilterActionDto) {
		return await super.getByFilters(dto);
	}
}
