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

@SwaggerIfcFindingController()
export class IfcFindingController extends BaseController<IfcFindingService> {
	constructor(private readonly service: IfcFindingService) {
		super(service);
	}

	@SwaggerIfcFindingCreate()
	async create(@Body() dto: CreateIfcFindingDto) {
		return await super.create(dto);
	}

	@SwaggerIfcFindingUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateIfcFindingDto) {
		return await super.update(id, dto);
	}

	@SwaggerIfcFindingDelete()
	async deleteCascade(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
		await this.service.deleteWithCascade(id, req.user.userId, req.user.school_id);
		return parseSuccessResponse(null);
	}

	@SwaggerIfcFindingGetAll()
	async getAll() {
		return await super.getAll();
	}

	// Method name differs from the base CRUD's `getById` to avoid an incompatible-override TS error;
	// the Swagger factory still mounts it at `GET /get-by-id/:id`, replacing the base shape.
	@SwaggerIfcFindingGetById()
	async getDetail(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
		const result = await this.service.getDetail(id, req.user.school_id);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcFindingGetByFilters()
	async getByFilters(@Body() dto: FilterIfcFindingDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerIfcFindingList()
	async list(@Body() dto: ListIfcFindingsDto, @Req() req: any) {
		const rows = await this.service.list(dto, req.user.school_id);
		return parseSuccessResponse(rows);
	}

	@SwaggerIfcFindingPatch()
	async patch(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: PatchIfcFindingDto,
		@Req() req: any,
	) {
		const result = await this.service.patch(id, dto, req.user.userId, req.user.school_id);
		return parseSuccessResponse(result);
	}
}
