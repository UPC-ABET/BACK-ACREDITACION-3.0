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
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerAcademicPeriodController()
export class AcademicPeriodController extends BaseController<AcademicPeriodService> {
	constructor(private readonly service: AcademicPeriodService) {
		super(service);
	}

	@SwaggerAcademicPeriodGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerAcademicPeriodGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerAcademicPeriodGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterAcademicPeriodDto) {
		return await super.getByFilters(dto);
	}
}
