import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerActionController,
	SwaggerActionCreate,
	SwaggerActionUpdate,
	SwaggerActionDelete,
	SwaggerActionGetAll,
	SwaggerActionGetById,
	SwaggerActionGetByFilters,
} from './docs/actions.swagger';
import { ActionService } from './actions.service';
import { CreateActionDto, UpdateActionDto, FilterActionDto } from '../model/actions.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerActionController()
export class ActionController extends BaseController<ActionService> {
	constructor(private readonly service: ActionService) {
		super(service);
	}

	@SwaggerActionCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateActionDto, @AcademicPeriodId() academicPeriodId?: number) {
		return await super.create({ ...dto, academicPeriodId });
	}

	@SwaggerActionUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActionDto) {
		return await super.update(id, dto);
	}

	@SwaggerActionDelete()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerActionGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerActionGetById()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerActionGetByFilters()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async getByFilters(
		@Body() dto: FilterActionDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return await super.getByFilters({ ...dto, academicPeriodId });
	}
}
