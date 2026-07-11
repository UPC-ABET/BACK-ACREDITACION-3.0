import { Body, HttpStatus, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
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
	SwaggerLcfcNotificationSummary,
	SwaggerLcfcNotificationSend,
	SwaggerLcfcNotificationStatus,
	SwaggerLcfcTokenValidate,
	SwaggerLcfcSurveyListByToken,
	SwaggerLcfcSurveyGetByToken,
	SwaggerLcfcSurveyComplete,
	SwaggerLcfcDashboard,
	SwaggerLcfcExport,
	SwaggerLcfcReportPdf,
	SwaggerLcfcReportPerception,
} from './docs/lcfc.swagger';
import { PerceptionReportDto } from 'src/modules/survey/shared/model/perception-report.dto';
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
	LcfcProgramQueryDto,
	LcfcSectionCommissionsQueryDto,
	LcfcReportQueryDto,
} from '../model/lcfc.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { Public } from 'src/modules/auth/protocols/jwt/decorators/public.decorator';
import { SchoolId } from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';

@SwaggerLcfcController()
export class LcfcController {
	constructor(private readonly lcfcService: LcfcService) {}

	@SwaggerLcfcConfigGenerate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configGenerate(
		@Body() dto: GenerateLcfcConfigDto,
		@SchoolId() schoolId: number,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(
			await this.lcfcService.generateConfigs(dto, schoolId, academicPeriodId),
		);
	}

	@SwaggerLcfcConfigGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configGetAll() {
		return parseSuccessResponse(await this.lcfcService.getAllConfigs());
	}

	@SwaggerLcfcConfigGetByFilters()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configGetByFilters(
		@Body() dto: FilterLcfcConfigDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return parseSuccessResponse(await this.lcfcService.getAllConfigs({ ...dto, academicPeriodId }));
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
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configAvailableSections(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: LcfcProgramQueryDto,
	) {
		return parseSuccessResponse(
			await this.lcfcService.getAvailableSections(query.programId, academicPeriodId),
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
	async configSectionCommissions(@Query() query: LcfcSectionCommissionsQueryDto) {
		return parseSuccessResponse(
			await this.lcfcService.getSectionCommissions(query.courseSectionId, query.programId),
		);
	}

	@SwaggerLcfcConfigSetDeadline()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configSetDeadline(
		@Body() dto: SetLcfcDeadlineDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(await this.lcfcService.setDeadline(dto, academicPeriodId));
	}

	@SwaggerLcfcNotificationSummary()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async notificationSummary(
		@Body() dto: SendLcfcNotificationDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(await this.lcfcService.getSendSummary(dto, academicPeriodId));
	}

	@SwaggerLcfcNotificationSend()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async notificationSend(
		@Body() dto: SendLcfcNotificationDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(
			this.lcfcService.startSendNotifications(dto, academicPeriodId),
			HttpStatus.ACCEPTED,
		);
	}

	@SwaggerLcfcNotificationStatus()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async notificationStatus(@Param('jobId') jobId: string) {
		return parseSuccessResponse(this.lcfcService.getSendNotificationStatus(jobId));
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
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async dashboardGet(
		@Body() dto: DashboardLcfcDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return parseSuccessResponse(await this.lcfcService.getDashboard({ ...dto, academicPeriodId }));
	}

	@SwaggerLcfcExport()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async exportSurveys(
		@Res() res: Response,
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: LcfcProgramQueryDto,
	) {
		const { buffer, fileName } = await this.lcfcService.exportSurveys(
			academicPeriodId,
			query.programId,
		);
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
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async reportPdf(
		@Res() res: Response,
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: LcfcReportQueryDto,
	) {
		const { pdf, filename } = await this.lcfcService.generateReportPdf(
			academicPeriodId,
			query.programId,
			query.lang ?? 'es',
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

	@SwaggerLcfcReportPerception()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async reportPerception(
		@Body() dto: PerceptionReportDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(
			await this.lcfcService.generatePerceptionReport(dto, academicPeriodId),
		);
	}
}
