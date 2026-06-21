import { Body, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
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
	SwaggerIfcSchools,
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
import { isAdmin } from 'src/modules/auth/model/authorization.functions';
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

@SwaggerIfcController()
export class IfcController extends BaseController<IfcService> {
	constructor(private readonly service: IfcService) {
		super(service);
	}

	@SwaggerIfcPrefill()
	@ApiSchoolHeader()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })
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
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async createIfc(
		@Body() dto: CreateIfcDto,
		@SchoolId() schoolId: number,
		@AcademicPeriodId() academicPeriodId: number,
		@CurrentUser() user: RequestUser,
	) {
		const result = await this.service.createIfc(dto, user.userId, schoolId, academicPeriodId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIfcDto) {
		return await super.update(id, dto);
	}

	@SwaggerIfcDelete()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerIfcGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerIfcGetByFilters()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async getByFilters(
		@Body() dto: FilterIfcDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return await super.getByFilters({ ...dto, academicPeriodId });
	}

	@SwaggerIfcList()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async list(@Body() dto: ListIfcsDto, @AcademicPeriodId() academicPeriodId: number) {
		return parseSuccessResponse(await this.service.list(dto, academicPeriodId));
	}

	@SwaggerIfcSchools()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })
	async schools(@AcademicPeriodId() academicPeriodId: number, @CurrentUser() user: RequestUser) {
		return parseSuccessResponse(
			await this.service.userSchools(user.userId, academicPeriodId, isAdmin(user)),
		);
	}

	@SwaggerIfcGetView()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })
	async getView(
		@Param('id', ParseIntPipe) id: number,
		@SchoolId() schoolId: number,
		@CurrentUser() user: RequestUser,
	) {
		const result = await this.service.getView(id, user.userId, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcSubmit()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async submit(
		@Param('id', ParseIntPipe) id: number,
		@SchoolId() schoolId: number,
		@CurrentUser() user: RequestUser,
	) {
		const result = await this.service.submit(id, user.userId, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcApprove()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async approve(
		@Param('id', ParseIntPipe) id: number,
		@SchoolId() schoolId: number,
		@CurrentUser() user: RequestUser,
	) {
		const result = await this.service.approve(id, user.userId, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcReject()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	@ApiSchoolHeader()
	async reject(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: RejectIfcDto,
		@SchoolId() schoolId: number,
		@CurrentUser() user: RequestUser,
	) {
		const result = await this.service.reject(id, user.userId, schoolId, dto);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcPatch()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.PATCH })
	async patch(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: IfcContentDto,
		@SchoolId() schoolId: number,
		@CurrentUser() user: RequestUser,
	) {
		const result = await this.service.patch(id, dto, user.userId, schoolId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcPdf()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })
	async pdf(
		@Param('id', ParseIntPipe) id: number,
		@Query() query: IfcPdfQueryDto,
		@SchoolId() schoolId: number,
		@CurrentUser() user: RequestUser,
		@Res({ passthrough: false }) res: Response,
	) {
		const lang = (query.lang ?? 'es') as 'es' | 'en';
		const { pdf, filename } = await this.service.generatePdf(id, user.userId, schoolId, lang);
		writeBinary(res, pdf, filename, 'application/pdf');
	}

	@SwaggerIfcPdfBulk()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async pdfBulk(
		@Body() dto: IfcPdfBulkDto,
		@SchoolId() schoolId: number,
		@CurrentUser() user: RequestUser,
		@Res({ passthrough: false }) res: Response,
	) {
		const { zip, filename } = await this.service.generatePdfBulk(
			dto.ifcIds,
			user.userId,
			schoolId,
			dto.lang,
		);
		writeBinary(res, zip, filename, 'application/zip');
	}

	@SwaggerIfcStatusReport()
	@ApiSchoolHeader()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
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
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async notify(
		@Body() dto: IfcNotifyDto,
		@AcademicPeriodId() academicPeriodId: number,
		@CurrentUser() user: RequestUser,
	) {
		const result = await this.service.notify(dto.chartId, academicPeriodId, user.userId);
		return parseSuccessResponse(result);
	}

	@SwaggerIfcNotifyAll()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async notifyAll(
		@Body() dto: IfcNotifyAllDto,
		@AcademicPeriodId() academicPeriodId: number,
		@CurrentUser() user: RequestUser,
	) {
		const result = await this.service.notifyAll(dto.chartIds, academicPeriodId, user.userId);
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
