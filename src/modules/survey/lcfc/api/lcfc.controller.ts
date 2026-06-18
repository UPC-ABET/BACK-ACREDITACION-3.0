import { Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
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
	SwaggerLcfcConfigSetDeadline,
	SwaggerLcfcNotificationSend,
	SwaggerLcfcTokenValidate,
	SwaggerLcfcSurveyGetByToken,
	SwaggerLcfcSurveyComplete,
	SwaggerLcfcDashboard,
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
		@Query('programId', ParseIntPipe) programId: number,
		@Query('academicPeriodId', ParseIntPipe) academicPeriodId: number,
	) {
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
}
