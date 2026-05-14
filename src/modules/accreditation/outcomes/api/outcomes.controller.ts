import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerOutcomeController,
	SwaggerOutcomeCreate,
	SwaggerOutcomeUpdate,
	SwaggerOutcomeDelete,
	SwaggerOutcomeGetAll,
	SwaggerOutcomeGetById,
	SwaggerOutcomeGetByFilters,
} from './docs/outcomes.swagger';
import { OutcomeService } from './outcomes.service';
import { CreateOutcomeDto, UpdateOutcomeDto, FilterOutcomeDto } from '../model/outcomes.dtos';

@SwaggerOutcomeController()
export class OutcomeController extends BaseController<OutcomeService> {
	constructor(private readonly service: OutcomeService) {
		super(service);
	}

	@SwaggerOutcomeCreate()
	async create(@Body() dto: CreateOutcomeDto) {
		return await super.create(dto);
	}

	@SwaggerOutcomeUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateOutcomeDto) {
		return await super.update(id, dto);
	}

	@SwaggerOutcomeDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerOutcomeGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerOutcomeGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerOutcomeGetByFilters()
	async getByFilters(@Body() dto: FilterOutcomeDto) {
		return await super.getByFilters(dto);
	}
}
