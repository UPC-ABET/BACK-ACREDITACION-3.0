import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerPlanController,
	SwaggerPlanCreate,
	SwaggerPlanUpdate,
	SwaggerPlanDelete,
	SwaggerPlanGetAll,
	SwaggerPlanGetById,
	SwaggerPlanGetByFilters,
} from './docs/plans.swagger';
import { PlanService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto, FilterPlanDto } from '../model/plans.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerPlanController()
export class PlanController extends BaseController<PlanService> {
	constructor(private readonly service: PlanService) {
		super(service);
	}

	@SwaggerPlanCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreatePlanDto, @AcademicPeriodId() academicPeriodId?: number) {
		return await super.create({ ...dto, academicPeriodId });
	}

	@SwaggerPlanUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
		return await super.update(id, dto);
	}

	@SwaggerPlanDelete()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerPlanGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerPlanGetById()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerPlanGetByFilters()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async getByFilters(
		@Body() dto: FilterPlanDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return await super.getByFilters({ ...dto, academicPeriodId });
	}
}
