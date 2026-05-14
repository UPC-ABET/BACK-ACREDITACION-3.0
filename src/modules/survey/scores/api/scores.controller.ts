import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { SwaggerScoreController, SwaggerScoreCreate, SwaggerScoreUpdate, SwaggerScoreDelete, SwaggerScoreGetAll, SwaggerScoreGetById, SwaggerScoreGetByFilters } from './docs/scores.swagger';
import { ScoreService } from './scores.service';
import { CreateScoreDto, UpdateScoreDto, FilterScoreDto } from '../model/scores.dtos';

@SwaggerScoreController()
export class ScoreController extends BaseController<ScoreService> {
	constructor(private readonly service: ScoreService) {
		super(service);
	}

	@SwaggerScoreCreate()
	async create(@Body() dto: CreateScoreDto) {
		return await super.create(dto);
	}

	@SwaggerScoreUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateScoreDto) {
		return await super.update(id, dto);
	}

	@SwaggerScoreDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerScoreGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerScoreGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerScoreGetByFilters()
	async getByFilters(@Body() dto: FilterScoreDto) {
		return await super.getByFilters(dto);
	}
}
