import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerEvaluationController,
	SwaggerEvaluationCreate,
	SwaggerEvaluationUpdate,
	SwaggerEvaluationDelete,
	SwaggerEvaluationGetAll,
	SwaggerEvaluationGetById,
	SwaggerEvaluationGetByFilters,
} from './docs/evaluations.swagger';
import { EvaluationService } from './evaluations.service';
import { CreateEvaluationDto, UpdateEvaluationDto, FilterEvaluationDto } from '../model/evaluations.dtos';

@SwaggerEvaluationController()
export class EvaluationController extends BaseController<EvaluationService> {
	constructor(private readonly service: EvaluationService) {
		super(service);
	}

	@SwaggerEvaluationCreate()
	async create(@Body() dto: CreateEvaluationDto) {
		return await super.create(dto);
	}

	@SwaggerEvaluationUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateEvaluationDto) {
		return await super.update(id, dto);
	}

	@SwaggerEvaluationDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerEvaluationGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerEvaluationGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerEvaluationGetByFilters()
	async getByFilters(@Body() dto: FilterEvaluationDto) {
		return await super.getByFilters(dto);
	}
}
