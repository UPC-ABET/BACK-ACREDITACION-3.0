import { Body, Param, ParseIntPipe, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
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
	SwaggerIfcPdf,
	SwaggerIfcPdfBulk,
	SwaggerIfcStatusReport,
	SwaggerIfcNotify,
	SwaggerIfcNotifyAll,
} from './docs/ifcs.swagger';
import { IfcService } from './ifcs.service';
import {
	UpdateIfcDto,
	FilterIfcDto,
	ListIfcsDto,
	RejectIfcDto,
	IfcPdfQueryDto,
	IfcPdfBulkDto,
	IfcStatusReportDto,
	IfcNotifyDto,
	IfcNotifyAllDto,
} from '../model/ifcs.dtos';
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
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIfcDto) {
		return await super.update(id, dto);
	}

	@SwaggerIfcDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
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

	@SwaggerIfcPdf()
	async pdf(
		@Param('id', ParseIntPipe) id: number,
		@Query() query: IfcPdfQueryDto,
		@Req() req: any,
		@Res({ passthrough: false }) res: Response,
	) {
		const lang = (query.lang ?? 'es') as 'es' | 'en';
		const { pdf, filename } = await this.service.generatePdf(
			id,
			req.user.userId,
			req.user.school_id,
			lang,
		);
		writeBinary(res, pdf, filename, 'application/pdf');
	}

	@SwaggerIfcPdfBulk()
	async pdfBulk(
		@Body() dto: IfcPdfBulkDto,
		@Req() req: any,
		@Res({ passthrough: false }) res: Response,
	) {
		const { zip, filename } = await this.service.generatePdfBulk(
			dto.ifc_ids,
			req.user.userId,
			req.user.school_id,
			dto.lang,
		);
		writeBinary(res, zip, filename, 'application/zip');
	}

	@SwaggerIfcStatusReport()
	async statusReport(
		@Body() dto: IfcStatusReportDto,
		@Req() req: any,
		@Res({ passthrough: false }) res: Response,
	) {
		const { xlsx, filename } = await this.service.generateStatusReport(dto, req.user.school_id);
		writeBinary(
			res,
			xlsx,
			filename,
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
	}

	@SwaggerIfcNotify()
	async notify(@Body() dto: IfcNotifyDto, @Req() req: any) {
		const result = await this.service.notify(dto.chart_id, dto.period_id, req.user.userId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcNotifyAll()
	async notifyAll(@Body() dto: IfcNotifyAllDto, @Req() req: any) {
		const result = await this.service.notifyAll(dto.chart_ids, dto.period_id, req.user.userId);
		return parseSuccessResponse(result);
	}
}

function writeBinary(res: Response, body: Buffer, filename: string, contentType: string) {
	const encoded = encodeURIComponent(filename);
	res.setHeader('Content-Type', contentType);
	res.setHeader(
		'Content-Disposition',
		`attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
	);
	res.setHeader('Content-Length', body.length.toString());
	res.end(body);
}
