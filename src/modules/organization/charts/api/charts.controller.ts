import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerChartController,
	SwaggerChartCreate,
	SwaggerChartUpdate,
	SwaggerChartDelete,
	SwaggerChartGetAll,
	SwaggerChartGetById,
	SwaggerChartGetByFilters,
	SwaggerChartMaintenanceTree,
	SwaggerChartMaintenanceCreate,
	SwaggerChartMaintenanceUpdate,
	SwaggerChartMaintenanceDelete,
	SwaggerChartMaintenanceResetPasswords,
} from './docs/charts.swagger';
import { ChartService } from './charts.service';
import {
	CreateChartDto,
	UpdateChartDto,
	FilterChartDto,
	CreateChartNodeDto,
	UpdateChartNodeDto,
	ResetMaintenancePasswordsDto,
} from '../model/charts.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import {
	SchoolId,
	ApiSchoolHeader,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerChartController()
export class ChartController extends BaseController<ChartService> {
	constructor(private readonly service: ChartService) {
		super(service);
	}

	@SwaggerChartCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateChartDto) {
		return await super.create(dto);
	}

	@SwaggerChartUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChartDto) {
		return await super.update(id, dto);
	}

	@SwaggerChartDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerChartGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerChartGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerChartGetByFilters()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(
		@Body() dto: FilterChartDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return await super.getByFilters({ ...dto, academicPeriodId });
	}

	@SwaggerChartMaintenanceTree()
	@ApiAcademicPeriodHeader()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async maintenanceTree(
		@AcademicPeriodId() academicPeriodId: number,
		@SchoolId() schoolId: number,
	) {
		return parseSuccessResponse(await this.service.getMaintenanceTree(academicPeriodId, schoolId));
	}

	@SwaggerChartMaintenanceCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async maintenanceCreate(
		@AcademicPeriodId() academicPeriodId: number,
		@Body() dto: CreateChartNodeDto,
	) {
		return parseSuccessResponse(
			await this.service.createNode(academicPeriodId, dto),
			HttpStatus.CREATED,
		);
	}

	@SwaggerChartMaintenanceUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.PUT })
	async maintenanceUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChartNodeDto) {
		return parseSuccessResponse(await this.service.updateNode(id, dto));
	}

	@SwaggerChartMaintenanceDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.DELETE })
	async maintenanceDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.deleteNode(id));
	}

	// DEAN sits at the shared root of every school's tree for a period (see resolveTreeRoot in
	// ChartService), so this action can reach a cross-school account -- gated behind ADMIN, not the
	// ORGANIZATION permission ordinary chart-node CRUD uses, so a single-school chart maintainer
	// cannot use it to reset the Dean's password.
	@SwaggerChartMaintenanceResetPasswords()
	@ApiAcademicPeriodHeader()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async maintenanceResetPasswords(
		@AcademicPeriodId() academicPeriodId: number,
		@SchoolId() schoolId: number,
		@Body() dto: ResetMaintenancePasswordsDto,
	) {
		return parseSuccessResponse(
			await this.service.resetMaintenancePasswords(academicPeriodId, schoolId, dto.entityTypeCodes),
		);
	}
}
