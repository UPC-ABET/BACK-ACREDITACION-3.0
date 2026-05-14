import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerRubricQuestionCriteriaController,
	SwaggerRubricQuestionCriteriaCreate,
	SwaggerRubricQuestionCriteriaUpdate,
	SwaggerRubricQuestionCriteriaDelete,
	SwaggerRubricQuestionCriteriaGetAll,
	SwaggerRubricQuestionCriteriaGetById,
	SwaggerRubricQuestionCriteriaGetByFilters,
} from './docs/rubric-question-criterias.swagger';
import { RubricQuestionCriteriaService } from './rubric-question-criterias.service';
import { CreateRubricQuestionCriteriaDto, UpdateRubricQuestionCriteriaDto, FilterRubricQuestionCriteriaDto } from '../model/rubric-question-criterias.dtos';

@SwaggerRubricQuestionCriteriaController()
export class RubricQuestionCriteriaController extends BaseController<RubricQuestionCriteriaService> {
	constructor(private readonly service: RubricQuestionCriteriaService) {
		super(service);
	}

	@SwaggerRubricQuestionCriteriaCreate()
	async create(@Body() dto: CreateRubricQuestionCriteriaDto) {
		return await super.create(dto);
	}

	@SwaggerRubricQuestionCriteriaUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateRubricQuestionCriteriaDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricQuestionCriteriaDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerRubricQuestionCriteriaGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerRubricQuestionCriteriaGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricQuestionCriteriaGetByFilters()
	async getByFilters(@Body() dto: FilterRubricQuestionCriteriaDto) {
		return await super.getByFilters(dto);
	}
}
