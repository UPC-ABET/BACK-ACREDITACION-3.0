import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import {
	SwaggerIfcFindingController,
	SwaggerIfcFindingCreate,
	SwaggerIfcFindingUpdate,
	SwaggerIfcFindingDelete,
	SwaggerIfcFindingGetAll,
	SwaggerIfcFindingGetById,
	SwaggerIfcFindingGetByFilters,
	SwaggerIfcFindingList,
	SwaggerIfcFindingPatch,
} from './docs/ifc-findings.swagger';
import { IfcFindingService } from './ifc-findings.service';
import {
	CreateIfcFindingDto,
	UpdateIfcFindingDto,
	FilterIfcFindingDto,
	ListIfcFindingsDto,
	PatchIfcFindingDto,
} from '../model/ifc-findings.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import {
	SchoolId,
	ApiSchoolHeader,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerIfcFindingController()
export class IfcFindingController extends BaseController<IfcFindingService> {
	constructor(private readonly service: IfcFindingService) {
		super(service);
	}

	@SwaggerIfcFindingCreate()
	@RequirePermission({ module: PERMISSION_MODULES.IFC_FINDINGS, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateIfcFindingDto) {
		return await super.create(dto);
	}

	@SwaggerIfcFindingUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.IFC_FINDINGS, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIfcFindingDto) {
		return await super.update(id, dto);
	}

	@SwaggerIfcFindingDelete()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFC_FINDINGS, action: PERMISSION_ACTIONS.DELETE })
	async deleteCascade(
		@Param('id', ParseIntPipe) id: number,
		@SchoolId() schoolId: number,
		@CurrentUser() user: RequestUser,
	) {
		await this.service.deleteWithCascade(id, user.userId, schoolId);
		return parseSuccessResponse(null);
	}

	@SwaggerIfcFindingGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.IFC_FINDINGS, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerIfcFindingGetById()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFC_FINDINGS, action: PERMISSION_ACTIONS.GET })
	async getDetail(@Param('id', ParseIntPipe) id: number, @SchoolId() schoolId: number) {
		const result = await this.service.getDetail(id, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcFindingGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.IFC_FINDINGS, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterIfcFindingDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerIfcFindingList()
	@ApiSchoolHeader()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFC_FINDINGS, action: PERMISSION_ACTIONS.POST })
	async list(
		@Body() dto: ListIfcFindingsDto,
		@SchoolId() schoolId: number,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		const rows = await this.service.list(dto, schoolId, academicPeriodId);
		return parseSuccessResponse(rows);
	}

	@SwaggerIfcFindingPatch()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFC_FINDINGS, action: PERMISSION_ACTIONS.PATCH })
	async patch(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: PatchIfcFindingDto,
		@SchoolId() schoolId: number,
		@CurrentUser() user: RequestUser,
	) {
		const result = await this.service.patch(id, dto, user.userId, schoolId);
		return parseSuccessResponse(result);
	}
}
