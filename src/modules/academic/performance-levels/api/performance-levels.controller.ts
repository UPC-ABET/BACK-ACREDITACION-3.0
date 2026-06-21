import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerPerformanceLevelController,
	SwaggerPerformanceLevelCreate,
	SwaggerPerformanceLevelUpdate,
	SwaggerPerformanceLevelDelete,
	SwaggerPerformanceLevelGetAll,
	SwaggerPerformanceLevelGetById,
	SwaggerPerformanceLevelGetByFilters,
} from './docs/performance-levels.swagger';
import { PerformanceLevelService } from './performance-levels.service';
import {
	CreatePerformanceLevelDto,
	UpdatePerformanceLevelDto,
	FilterPerformanceLevelDto,
} from '../model/performance-levels.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerPerformanceLevelController()
export class PerformanceLevelController extends BaseController<PerformanceLevelService> {
	constructor(private readonly service: PerformanceLevelService) {
		super(service);
	}

	@SwaggerPerformanceLevelCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(
		@Body() dto: CreatePerformanceLevelDto,
		@AcademicPeriodId() academicPeriodId?: number,
	) {
		return await super.create({ ...dto, academicPeriodId });
	}

	@SwaggerPerformanceLevelUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePerformanceLevelDto) {
		return await super.update(id, dto);
	}

	@SwaggerPerformanceLevelDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerPerformanceLevelGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerPerformanceLevelGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerPerformanceLevelGetByFilters()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(
		@Body() dto: FilterPerformanceLevelDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return await super.getByFilters({ ...dto, academicPeriodId });
	}
}
