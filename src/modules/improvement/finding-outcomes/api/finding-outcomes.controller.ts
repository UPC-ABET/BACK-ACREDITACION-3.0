import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerFindingOutcomeController,
	SwaggerFindingOutcomeCreate,
	SwaggerFindingOutcomeUpdate,
	SwaggerFindingOutcomeDelete,
	SwaggerFindingOutcomeGetAll,
	SwaggerFindingOutcomeGetById,
	SwaggerFindingOutcomeGetByFilters,
} from './docs/finding-outcomes.swagger';
import { FindingOutcomeService } from './finding-outcomes.service';
import {
	CreateFindingOutcomeDto,
	UpdateFindingOutcomeDto,
	FilterFindingOutcomeDto,
} from '../model/finding-outcomes.dtos';

@SwaggerFindingOutcomeController()
export class FindingOutcomeController extends BaseController<FindingOutcomeService> {
	constructor(private readonly service: FindingOutcomeService) {
		super(service);
	}

	@SwaggerFindingOutcomeCreate()
	async create(@Body() dto: CreateFindingOutcomeDto) {
		return await super.create(dto);
	}

	@SwaggerFindingOutcomeUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateFindingOutcomeDto) {
		return await super.update(id, dto);
	}

	@SwaggerFindingOutcomeDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerFindingOutcomeGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFindingOutcomeGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerFindingOutcomeGetByFilters()
	async getByFilters(@Body() dto: FilterFindingOutcomeDto) {
		return await super.getByFilters(dto);
	}
}
