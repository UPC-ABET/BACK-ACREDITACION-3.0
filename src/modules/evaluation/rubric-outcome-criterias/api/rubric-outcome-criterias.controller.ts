import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerRubricOutcomeCriteriaController,
	SwaggerRubricOutcomeCriteriaCreate,
	SwaggerRubricOutcomeCriteriaUpdate,
	SwaggerRubricOutcomeCriteriaDelete,
	SwaggerRubricOutcomeCriteriaGetAll,
	SwaggerRubricOutcomeCriteriaGetById,
	SwaggerRubricOutcomeCriteriaGetByFilters,
} from './docs/rubric-outcome-criterias.swagger';
import { RubricOutcomeCriteriaService } from './rubric-outcome-criterias.service';
import { CreateRubricOutcomeCriteriaDto, UpdateRubricOutcomeCriteriaDto, FilterRubricOutcomeCriteriaDto } from '../model/rubric-outcome-criterias.dtos';

@SwaggerRubricOutcomeCriteriaController()
export class RubricOutcomeCriteriaController extends BaseController<RubricOutcomeCriteriaService> {
	constructor(private readonly service: RubricOutcomeCriteriaService) {
		super(service);
	}

	@SwaggerRubricOutcomeCriteriaCreate()
	async create(@Body() dto: CreateRubricOutcomeCriteriaDto) {
		return await super.create(dto);
	}

	@SwaggerRubricOutcomeCriteriaUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateRubricOutcomeCriteriaDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricOutcomeCriteriaDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerRubricOutcomeCriteriaGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerRubricOutcomeCriteriaGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricOutcomeCriteriaGetByFilters()
	async getByFilters(@Body() dto: FilterRubricOutcomeCriteriaDto) {
		return await super.getByFilters(dto);
	}
}
