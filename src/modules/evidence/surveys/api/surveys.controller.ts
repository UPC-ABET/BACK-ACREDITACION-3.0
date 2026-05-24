import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerSurveyController,
	SwaggerSurveyCreate,
	SwaggerSurveyUpdate,
	SwaggerSurveyDelete,
	SwaggerSurveyGetAll,
	SwaggerSurveyGetById,
	SwaggerSurveyGetByFilters,
} from './docs/surveys.swagger';
import { SurveyService } from './surveys.service';
import { CreateSurveyDto, UpdateSurveyDto, FilterSurveyDto } from '../model/surveys.dtos';

@SwaggerSurveyController()
export class SurveyController extends BaseController<SurveyService> {
	constructor(private readonly service: SurveyService) {
		super(service);
	}

	@SwaggerSurveyCreate()
	async create(@Body() dto: CreateSurveyDto) {
		return await super.create(dto);
	}

	@SwaggerSurveyUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateSurveyDto) {
		return await super.update(id, dto);
	}

	@SwaggerSurveyDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerSurveyGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerSurveyGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerSurveyGetByFilters()
	async getByFilters(@Body() dto: FilterSurveyDto) {
		return await super.getByFilters(dto);
	}
}
