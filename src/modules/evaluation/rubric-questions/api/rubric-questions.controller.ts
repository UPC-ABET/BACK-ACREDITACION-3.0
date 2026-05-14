import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerRubricQuestionController,
	SwaggerRubricQuestionCreate,
	SwaggerRubricQuestionUpdate,
	SwaggerRubricQuestionDelete,
	SwaggerRubricQuestionGetAll,
	SwaggerRubricQuestionGetById,
	SwaggerRubricQuestionGetByFilters,
} from './docs/rubric-questions.swagger';
import { RubricQuestionService } from './rubric-questions.service';
import { CreateRubricQuestionDto, UpdateRubricQuestionDto, FilterRubricQuestionDto } from '../model/rubric-questions.dtos';

@SwaggerRubricQuestionController()
export class RubricQuestionController extends BaseController<RubricQuestionService> {
	constructor(private readonly service: RubricQuestionService) {
		super(service);
	}

	@SwaggerRubricQuestionCreate()
	async create(@Body() dto: CreateRubricQuestionDto) {
		return await super.create(dto);
	}

	@SwaggerRubricQuestionUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateRubricQuestionDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricQuestionDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerRubricQuestionGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerRubricQuestionGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricQuestionGetByFilters()
	async getByFilters(@Body() dto: FilterRubricQuestionDto) {
		return await super.getByFilters(dto);
	}
}
