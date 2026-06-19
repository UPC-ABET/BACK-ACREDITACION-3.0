import { Body, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';
import { LcfcService } from './lcfc.service';
import {
	SwaggerLcfcController,
	SwaggerLcfcConfigGenerate,
	SwaggerLcfcConfigGetAll,
	SwaggerLcfcConfigGetByFilters,
	SwaggerLcfcConfigGetById,
	SwaggerLcfcConfigUpdate,
	SwaggerLcfcConfigUpdateStatus,
	SwaggerLcfcConfigClone,
	SwaggerLcfcConfigDelete,
	SwaggerLcfcConfigAvailableSections,
	SwaggerLcfcConfigSectionOutcomes,
	SwaggerLcfcConfigSectionCommissions,
	SwaggerLcfcConfigSetDeadline,
	SwaggerLcfcNotificationSend,
	SwaggerLcfcTokenValidate,
	SwaggerLcfcSurveyListByToken,
	SwaggerLcfcSurveyGetByToken,
	SwaggerLcfcSurveyComplete,
	SwaggerLcfcDashboard,
	SwaggerLcfcExport,
	SwaggerLcfcReportPdf,
} from './docs/lcfc.swagger';
import {
	GenerateLcfcConfigDto,
	CloneLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
	SetLcfcDeadlineDto,
	SendLcfcNotificationDto,
	GetLcfcSurveyByTokenDto,
	CompleteLcfcSurveyDto,
	DashboardLcfcDto,
} from '../model/lcfc.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { Public } from 'src/modules/auth/protocols/jwt/decorators/public.decorator';
import { SchoolId } from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';

@SwaggerLcfcController()
export class LcfcController {
	constructor(private readonly lcfcService: LcfcService) {}

	@SwaggerLcfcConfigGenerate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configGenerate(@Body() dto: GenerateLcfcConfigDto, @SchoolId() schoolId: number) {
		return parseSuccessResponse(await this.lcfcService.generateConfigs(dto, schoolId));
	}

	@SwaggerLcfcConfigGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configGetAll() {
		return parseSuccessResponse(await this.lcfcService.getAllConfigs());
	}

	@SwaggerLcfcConfigGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configGetByFilters(@Body() dto: FilterLcfcConfigDto) {
		return parseSuccessResponse(await this.lcfcService.getAllConfigs(dto));
	}

	@SwaggerLcfcConfigGetById()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.lcfcService.getConfigById(id));
	}

	@SwaggerLcfcConfigUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.PUT })
	async configUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLcfcConfigDto) {
		return parseSuccessResponse(await this.lcfcService.updateConfig(id, dto));
	}

	@SwaggerLcfcConfigUpdateStatus()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configUpdateStatus(@Body() dto: UpdateLcfcConfigStatusDto) {
		return parseSuccessResponse(await this.lcfcService.updateConfigStatus(dto));
	}

	@SwaggerLcfcConfigClone()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configClone(@Body() dto: CloneLcfcConfigDto) {
		return parseSuccessResponse(await this.lcfcService.cloneConfig(dto));
	}

	@SwaggerLcfcConfigDelete()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.DELETE })
	async configDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.lcfcService.deleteConfig(id));
	}

	@SwaggerLcfcConfigAvailableSections()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configAvailableSections(
		@Query('academicPeriodId', ParseIntPipe) academicPeriodId: number,
		@Query('programId') programIdRaw?: string,
	) {
		const programId = programIdRaw && Number(programIdRaw) > 0 ? Number(programIdRaw) : undefined;
		return parseSuccessResponse(
			await this.lcfcService.getAvailableSections(programId, academicPeriodId),
		);
	}

	@SwaggerLcfcConfigSectionOutcomes()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configSectionOutcomes(
		@Query('courseSectionId', ParseIntPipe) courseSectionId: number,
		@Query('programId', ParseIntPipe) programId: number,
	) {
		return parseSuccessResponse(
			await this.lcfcService.getSectionOutcomes(courseSectionId, programId),
		);
	}

	@SwaggerLcfcConfigSectionCommissions()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configSectionCommissions(
		@Query('courseSectionId', ParseIntPipe) courseSectionId: number,
		@Query('programId') programIdRaw?: string,
	) {
		const programId = programIdRaw && Number(programIdRaw) > 0 ? Number(programIdRaw) : undefined;
		return parseSuccessResponse(
			await this.lcfcService.getSectionCommissions(courseSectionId, programId),
		);
	}

	@SwaggerLcfcConfigSetDeadline()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configSetDeadline(@Body() dto: SetLcfcDeadlineDto) {
		return parseSuccessResponse(await this.lcfcService.setDeadline(dto));
	}

	@SwaggerLcfcNotificationSend()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async notificationSend(@Body() dto: SendLcfcNotificationDto) {
		return parseSuccessResponse(await this.lcfcService.sendNotifications(dto));
	}

	@SwaggerLcfcTokenValidate()
	@Public()
	async tokenValidate(@Param('token') token: string) {
		return parseSuccessResponse(await this.lcfcService.validateToken(token));
	}

	@SwaggerLcfcSurveyListByToken()
	@Public()
	async surveyListByToken(@Param('token') token: string) {
		return parseSuccessResponse(await this.lcfcService.getStudentSurveys(token));
	}

	@SwaggerLcfcSurveyGetByToken()
	@Public()
	async surveyGetByToken(@Body() dto: GetLcfcSurveyByTokenDto) {
		return parseSuccessResponse(await this.lcfcService.getSurveyByToken(dto));
	}

	@SwaggerLcfcSurveyComplete()
	@Public()
	async surveyComplete(@Body() dto: CompleteLcfcSurveyDto) {
		return parseSuccessResponse(await this.lcfcService.completeSurvey(dto));
	}

	@SwaggerLcfcDashboard()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async dashboardGet(@Body() dto: DashboardLcfcDto) {
		return parseSuccessResponse(await this.lcfcService.getDashboard(dto));
	}

	@SwaggerLcfcExport()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async exportSurveys(
		@Query('academicPeriodId', ParseIntPipe) academicPeriodId: number,
		@Res() res: Response,
		@Query('programId') programIdRaw?: string,
	) {
		const programId =
			programIdRaw !== undefined && programIdRaw !== '' ? Number(programIdRaw) : undefined;
		const { buffer, fileName } = await this.lcfcService.exportSurveys(academicPeriodId, programId);
		const encoded = encodeURIComponent(fileName);
		res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`,
		);
		res.setHeader('Content-Length', buffer.length.toString());
		res.end(buffer);
	}

	@SwaggerLcfcReportPdf()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async reportPdf(
		@Query('academicPeriodId', ParseIntPipe) academicPeriodId: number,
		@Res() res: Response,
		@Query('programId') programIdRaw?: string,
		@Query('lang') langRaw?: string,
	) {
		const programId =
			programIdRaw !== undefined && programIdRaw !== '' ? Number(programIdRaw) : undefined;
		const lang = langRaw === 'en' ? 'en' : 'es';
		const { pdf, filename } = await this.lcfcService.generateReportPdf(
			academicPeriodId,
			programId,
			lang,
		);
		const encoded = encodeURIComponent(filename);
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
		);
		res.setHeader('Content-Length', pdf.length.toString());
		res.end(pdf);
	}
}
