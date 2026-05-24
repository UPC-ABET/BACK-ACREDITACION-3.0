import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerAcademicPeriodController,
	SwaggerAcademicPeriodCreate,
	SwaggerAcademicPeriodUpdate,
	SwaggerAcademicPeriodDelete,
	SwaggerAcademicPeriodGetAll,
	SwaggerAcademicPeriodGetById,
	SwaggerAcademicPeriodGetByFilters,
} from './docs/academic-periods.swagger';
import { AcademicPeriodService } from './academic-periods.service';
import {
	CreateAcademicPeriodDto,
	UpdateAcademicPeriodDto,
	FilterAcademicPeriodDto,
} from '../model/academic-periods.dtos';

@SwaggerAcademicPeriodController()
export class AcademicPeriodController extends BaseController<AcademicPeriodService> {
	constructor(private readonly service: AcademicPeriodService) {
		super(service);
	}

	@SwaggerAcademicPeriodCreate()
	async create(@Body() dto: CreateAcademicPeriodDto) {
		return await super.create(dto);
	}

	@SwaggerAcademicPeriodUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateAcademicPeriodDto) {
		return await super.update(id, dto);
	}

	@SwaggerAcademicPeriodDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerAcademicPeriodGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerAcademicPeriodGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerAcademicPeriodGetByFilters()
	async getByFilters(@Body() dto: FilterAcademicPeriodDto) {
		return await super.getByFilters(dto);
	}
}
