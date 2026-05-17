import { Body, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import {
	SwaggerIfcController,
	SwaggerIfcCreate,
	SwaggerIfcUpdate,
	SwaggerIfcDelete,
	SwaggerIfcGetAll,
	SwaggerIfcGetByFilters,
	SwaggerIfcList,
	SwaggerIfcGetView,
	SwaggerIfcSubmit,
	SwaggerIfcApprove,
	SwaggerIfcReject,
	SwaggerIfcPatch,
	SwaggerIfcPrefill,
} from './docs/ifcs.swagger';
import { IfcService } from './ifcs.service';
import { UpdateIfcDto, FilterIfcDto, ListIfcsDto, RejectIfcDto } from '../model/ifcs.dtos';
import { CreateIfcDto, IfcContentDto, IfcPrefillQueryDto } from '../model/ifcs-content.dtos';

@SwaggerIfcController()
export class IfcController extends BaseController<IfcService> {
	constructor(private readonly service: IfcService) {
		super(service);
	}

	@SwaggerIfcPrefill()
	async prefill(@Query() query: IfcPrefillQueryDto, @Req() req: any) {
		const result = await this.service.prefill(query, req.user.school_id);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcCreate()
	async createIfc(@Body() dto: CreateIfcDto, @Req() req: any) {
		const result = await this.service.createIfc(dto, req.user.userId, req.user.school_id);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateIfcDto) {
		return await super.update(id, dto);
	}

	@SwaggerIfcDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerIfcGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerIfcGetByFilters()
	async getByFilters(@Body() dto: FilterIfcDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerIfcList()
	async list(@Body() dto: ListIfcsDto) {
		return parseSuccessResponse(await this.service.list(dto));
	}

	@SwaggerIfcGetView()
	async getView(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
		const result = await this.service.getView(id, req.user.userId, req.user.school_id);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcSubmit()
	async submit(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
		const result = await this.service.submit(id, req.user.userId, req.user.school_id);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcApprove()
	async approve(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
		const result = await this.service.approve(id, req.user.userId, req.user.school_id);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcReject()
	async reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectIfcDto, @Req() req: any) {
		const result = await this.service.reject(id, req.user.userId, req.user.school_id, dto);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcPatch()
	async patch(@Param('id', ParseIntPipe) id: number, @Body() dto: IfcContentDto, @Req() req: any) {
		const result = await this.service.patch(id, dto, req.user.userId, req.user.school_id);
		return parseSuccessResponse(result);
	}
}
