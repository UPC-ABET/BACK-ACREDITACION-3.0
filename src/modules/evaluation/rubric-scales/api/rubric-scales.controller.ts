import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerRubricScaleController,
	SwaggerRubricScaleCreate,
	SwaggerRubricScaleUpdate,
	SwaggerRubricScaleDelete,
	SwaggerRubricScaleGetAll,
	SwaggerRubricScaleGetById,
	SwaggerRubricScaleGetByFilters,
} from './docs/rubric-scales.swagger';
import { RubricScaleService } from './rubric-scales.service';
import { CreateRubricScaleDto, UpdateRubricScaleDto, FilterRubricScaleDto } from '../model/rubric-scales.dtos';

@SwaggerRubricScaleController()
export class RubricScaleController extends BaseController<RubricScaleService> {
	constructor(private readonly service: RubricScaleService) {
		super(service);
	}

	@SwaggerRubricScaleCreate()
	async create(@Body() dto: CreateRubricScaleDto) {
		return await super.create(dto);
	}

	@SwaggerRubricScaleUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateRubricScaleDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricScaleDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerRubricScaleGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerRubricScaleGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricScaleGetByFilters()
	async getByFilters(@Body() dto: FilterRubricScaleDto) {
		return await super.getByFilters(dto);
	}
}
