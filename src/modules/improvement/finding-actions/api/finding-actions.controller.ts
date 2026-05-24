import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerFindingActionController,
	SwaggerFindingActionCreate,
	SwaggerFindingActionUpdate,
	SwaggerFindingActionDelete,
	SwaggerFindingActionGetAll,
	SwaggerFindingActionGetById,
	SwaggerFindingActionGetByFilters,
} from './docs/finding-actions.swagger';
import { FindingActionService } from './finding-actions.service';
import {
	CreateFindingActionDto,
	UpdateFindingActionDto,
	FilterFindingActionDto,
} from '../model/finding-actions.dtos';

@SwaggerFindingActionController()
export class FindingActionController extends BaseController<FindingActionService> {
	constructor(private readonly service: FindingActionService) {
		super(service);
	}

	@SwaggerFindingActionCreate()
	async create(@Body() dto: CreateFindingActionDto) {
		return await super.create(dto);
	}

	@SwaggerFindingActionUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFindingActionDto) {
		return await super.update(id, dto);
	}

	@SwaggerFindingActionDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerFindingActionGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFindingActionGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerFindingActionGetByFilters()
	async getByFilters(@Body() dto: FilterFindingActionDto) {
		return await super.getByFilters(dto);
	}
}
