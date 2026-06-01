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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerAcademicPeriodController()
export class AcademicPeriodController extends BaseController<AcademicPeriodService> {
	constructor(private readonly service: AcademicPeriodService) {
		super(service);
	}

	@SwaggerAcademicPeriodGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerAcademicPeriodGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerAcademicPeriodGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterAcademicPeriodDto) {
		return await super.getByFilters(dto);
	}
}
