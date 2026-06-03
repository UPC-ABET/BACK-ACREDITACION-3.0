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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	SchoolId,
	ApiSchoolHeader,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';

const IFCS_MODULE = 'IFCS';

@SwaggerIfcController()
export class IfcController extends BaseController<IfcService> {
	constructor(private readonly service: IfcService) {
		super(service);
	}

	@SwaggerIfcPrefill()
	@ApiSchoolHeader()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'GET' })
	async prefill(
		@Query() query: IfcPrefillQueryDto,
		@SchoolId() schoolId: number,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		const result = await this.service.prefill(query, schoolId, academicPeriodId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcCreate()
	@ApiSchoolHeader()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async createIfc(
		@Body() dto: CreateIfcDto,
		@SchoolId() schoolId: number,
		@AcademicPeriodId() academicPeriodId: number,
		@Req() req: any,
	) {
		const result = await this.service.createIfc(dto, req.user.userId, schoolId, academicPeriodId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcUpdate()
	@RequirePermission({ module: IFCS_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIfcDto) {
		return await super.update(id, dto);
	}

	@SwaggerIfcDelete()
	@RequirePermission({ module: IFCS_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerIfcGetAll()
	@RequirePermission({ module: IFCS_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerIfcGetByFilters()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterIfcDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerIfcList()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async list(@Body() dto: ListIfcsDto, @AcademicPeriodId() academicPeriodId: number) {
		return parseSuccessResponse(await this.service.list(dto, academicPeriodId));
	}

	@SwaggerIfcGetView()
	@ApiSchoolHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'GET' })
	async getView(
		@Param('id', ParseIntPipe) id: number,
		@SchoolId() schoolId: number,
		@Req() req: any,
	) {
		const result = await this.service.getView(id, req.user.userId, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcSubmit()
	@ApiSchoolHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async submit(@Param('id', ParseIntPipe) id: number, @SchoolId() schoolId: number, @Req() req: any) {
		const result = await this.service.submit(id, req.user.userId, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcApprove()
	@ApiSchoolHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async approve(
		@Param('id', ParseIntPipe) id: number,
		@SchoolId() schoolId: number,
		@Req() req: any,
	) {
		const result = await this.service.approve(id, req.user.userId, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcReject()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	@ApiSchoolHeader()
	async reject(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: RejectIfcDto,
		@SchoolId() schoolId: number,
		@Req() req: any,
	) {
		const result = await this.service.reject(id, req.user.userId, schoolId, dto);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcPatch()
	@ApiSchoolHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'PATCH' })
	async patch(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: IfcContentDto,
		@SchoolId() schoolId: number,
		@Req() req: any,
	) {
		const result = await this.service.patch(id, dto, req.user.userId, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcPdf()
	@ApiSchoolHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'GET' })
	async pdf(
		@Param('id', ParseIntPipe) id: number,
		@Query() query: IfcPdfQueryDto,
		@SchoolId() schoolId: number,
		@Req() req: any,
		@Res({ passthrough: false }) res: Response,
	) {
		const lang = (query.lang ?? 'es') as 'es' | 'en';
		const { pdf, filename } = await this.service.generatePdf(
			id,
			req.user.userId,
			schoolId,
			lang,
		);
		writeBinary(res, pdf, filename, 'application/pdf');
	}

	@SwaggerIfcPdfBulk()
	@ApiSchoolHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async pdfBulk(
		@Body() dto: IfcPdfBulkDto,
		@SchoolId() schoolId: number,
		@Req() req: any,
		@Res({ passthrough: false }) res: Response,
	) {
		const { zip, filename } = await this.service.generatePdfBulk(
			dto.ifcIds,
			req.user.userId,
			schoolId,
			dto.lang,
		);
		writeBinary(res, zip, filename, 'application/zip');
	}

	@SwaggerIfcStatusReport()
	@ApiSchoolHeader()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async statusReport(
		@Body() dto: IfcStatusReportDto,
		@SchoolId() schoolId: number,
		@AcademicPeriodId() academicPeriodId: number,
		@Res({ passthrough: false }) res: Response,
	) {
		const { xlsx, filename } = await this.service.generateStatusReport(
			dto,
			schoolId,
			academicPeriodId,
		);
		writeBinary(
			res,
			xlsx,
			filename,
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
	}

	@SwaggerIfcNotify()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async notify(
		@Body() dto: IfcNotifyDto,
		@AcademicPeriodId() academicPeriodId: number,
		@Req() req: any,
	) {
		const result = await this.service.notify(dto.chartId, academicPeriodId, req.user.userId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcNotifyAll()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async notifyAll(
		@Body() dto: IfcNotifyAllDto,
		@AcademicPeriodId() academicPeriodId: number,
		@Req() req: any,
	) {
		const result = await this.service.notifyAll(dto.chartIds, academicPeriodId, req.user.userId);
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
