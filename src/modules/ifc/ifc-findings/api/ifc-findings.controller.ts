import { Body, Param, ParseIntPipe, Req } from '@nestjs/common';
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
import {
	SchoolId,
	ApiSchoolHeader,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';

const IFC_FINDINGS_MODULE = 'IFC_FINDINGS';

@SwaggerIfcFindingController()
export class IfcFindingController extends BaseController<IfcFindingService> {
	constructor(private readonly service: IfcFindingService) {
		super(service);
	}

	@SwaggerIfcFindingCreate()
	@RequirePermission({ module: IFC_FINDINGS_MODULE, action: 'POST' })
	async create(@Body() dto: CreateIfcFindingDto) {
		return await super.create(dto);
	}

	@SwaggerIfcFindingUpdate()
	@RequirePermission({ module: IFC_FINDINGS_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIfcFindingDto) {
		return await super.update(id, dto);
	}

	@SwaggerIfcFindingDelete()
	@ApiSchoolHeader()
	@RequirePermission({ module: IFC_FINDINGS_MODULE, action: 'DELETE' })
	async deleteCascade(
		@Param('id', ParseIntPipe) id: number,
		@SchoolId() schoolId: number,
		@Req() req: any,
	) {
		await this.service.deleteWithCascade(id, req.user.userId, schoolId);
		return parseSuccessResponse(null);
	}

	@SwaggerIfcFindingGetAll()
	@RequirePermission({ module: IFC_FINDINGS_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerIfcFindingGetById()
	@ApiSchoolHeader()
	@RequirePermission({ module: IFC_FINDINGS_MODULE, action: 'GET' })
	async getDetail(@Param('id', ParseIntPipe) id: number, @SchoolId() schoolId: number) {
		const result = await this.service.getDetail(id, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcFindingGetByFilters()
	@RequirePermission({ module: IFC_FINDINGS_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterIfcFindingDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerIfcFindingList()
	@ApiSchoolHeader()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: IFC_FINDINGS_MODULE, action: 'POST' })
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
	@RequirePermission({ module: IFC_FINDINGS_MODULE, action: 'PATCH' })
	async patch(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: PatchIfcFindingDto,
		@SchoolId() schoolId: number,
		@Req() req: any,
	) {
		const result = await this.service.patch(id, dto, req.user.userId, schoolId);
		return parseSuccessResponse(result);
	}
}
