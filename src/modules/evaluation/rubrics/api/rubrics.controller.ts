import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { SwaggerRubricController, SwaggerRubricCreate, SwaggerRubricUpdate, SwaggerRubricDelete, SwaggerRubricGetAll, SwaggerRubricGetById, SwaggerRubricGetByFilters } from './docs/rubrics.swagger';
import { RubricService } from './rubrics.service';
import { CreateRubricDto, UpdateRubricDto, FilterRubricDto } from '../model/rubrics.dtos';

@SwaggerRubricController()
export class RubricController extends BaseController<RubricService> {
	constructor(private readonly service: RubricService) {
		super(service);
	}

	@SwaggerRubricCreate()
	async create(@Body() dto: CreateRubricDto) {
		return await super.create(dto);
	}

	@SwaggerRubricUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateRubricDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerRubricGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerRubricGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricGetByFilters()
	async getByFilters(@Body() dto: FilterRubricDto) {
		return await super.getByFilters(dto);
	}
}
