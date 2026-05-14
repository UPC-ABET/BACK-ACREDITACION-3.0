import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerRubricScoreController,
	SwaggerRubricScoreCreate,
	SwaggerRubricScoreUpdate,
	SwaggerRubricScoreDelete,
	SwaggerRubricScoreGetAll,
	SwaggerRubricScoreGetById,
	SwaggerRubricScoreGetByFilters,
} from './docs/rubric-scores.swagger';
import { RubricScoreService } from './rubric-scores.service';
import { CreateRubricScoreDto, UpdateRubricScoreDto, FilterRubricScoreDto } from '../model/rubric-scores.dtos';

@SwaggerRubricScoreController()
export class RubricScoreController extends BaseController<RubricScoreService> {
	constructor(private readonly service: RubricScoreService) {
		super(service);
	}

	@SwaggerRubricScoreCreate()
	async create(@Body() dto: CreateRubricScoreDto) {
		return await super.create(dto);
	}

	@SwaggerRubricScoreUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateRubricScoreDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricScoreDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerRubricScoreGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerRubricScoreGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricScoreGetByFilters()
	async getByFilters(@Body() dto: FilterRubricScoreDto) {
		return await super.getByFilters(dto);
	}
}
