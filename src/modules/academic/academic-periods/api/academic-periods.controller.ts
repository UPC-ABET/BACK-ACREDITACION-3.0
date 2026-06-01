import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerAcademicPeriodController,
	SwaggerAcademicPeriodGetAll,
	SwaggerAcademicPeriodGetById,
	SwaggerAcademicPeriodGetByFilters,
} from './docs/academic-periods.swagger';
import { AcademicPeriodService } from './academic-periods.service';
import { FilterAcademicPeriodDto } from '../model/academic-periods.dtos';

@SwaggerAcademicPeriodController()
export class AcademicPeriodController extends BaseController<AcademicPeriodService> {
	constructor(private readonly service: AcademicPeriodService) {
		super(service);
	}

	@SwaggerAcademicPeriodGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerAcademicPeriodGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerAcademicPeriodGetByFilters()
	async getByFilters(@Body() dto: FilterAcademicPeriodDto) {
		return await super.getByFilters(dto);
	}
}
