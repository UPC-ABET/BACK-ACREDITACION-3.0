import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerOutcomeConfigController,
	SwaggerOutcomeConfigCreate,
	SwaggerOutcomeConfigUpdate,
	SwaggerOutcomeConfigDelete,
	SwaggerOutcomeConfigGetAll,
	SwaggerOutcomeConfigGetById,
	SwaggerOutcomeConfigGetByFilters,
} from './docs/outcome-configs.swagger';
import { OutcomeConfigService } from './outcome-configs.service';
import { CreateOutcomeConfigDto, UpdateOutcomeConfigDto, FilterOutcomeConfigDto } from '../model/outcome-configs.dtos';

@SwaggerOutcomeConfigController()
export class OutcomeConfigController extends BaseController<OutcomeConfigService> {
	constructor(private readonly service: OutcomeConfigService) {
		super(service);
	}

	@SwaggerOutcomeConfigCreate()
	async create(@Body() dto: CreateOutcomeConfigDto) {
		return await super.create(dto);
	}

	@SwaggerOutcomeConfigUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateOutcomeConfigDto) {
		return await super.update(id, dto);
	}

	@SwaggerOutcomeConfigDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerOutcomeConfigGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerOutcomeConfigGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerOutcomeConfigGetByFilters()
	async getByFilters(@Body() dto: FilterOutcomeConfigDto) {
		return await super.getByFilters(dto);
	}
}
