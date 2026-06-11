import { Body, Param } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { LcfcService } from './lcfc.service';
import {
	SwaggerLcfcController,
	SwaggerLcfcConfigGenerate,
	SwaggerLcfcConfigGetAll,
	SwaggerLcfcConfigGetByFilters,
	SwaggerLcfcConfigUpdateStatus,
	SwaggerLcfcNotificationSend,
	SwaggerLcfcTokenValidate,
	SwaggerLcfcSurveyGetByToken,
	SwaggerLcfcSurveyComplete,
	SwaggerLcfcDashboard,
} from './docs/lcfc.swagger';
import {
	GenerateLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
	SendLcfcNotificationDto,
	GetLcfcSurveyByTokenDto,
	CompleteLcfcSurveyDto,
	DashboardLcfcDto,
} from '../model/lcfc.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerLcfcController()
export class LcfcController {
	constructor(private readonly lcfcService: LcfcService) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerLcfcConfigGenerate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configGenerate(@Body() dto: GenerateLcfcConfigDto) {
		return parseSuccessResponse(await this.lcfcService.generateConfigs(dto));
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

	@SwaggerLcfcConfigUpdateStatus()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configUpdateStatus(@Body() dto: UpdateLcfcConfigStatusDto) {
		return parseSuccessResponse(await this.lcfcService.updateConfigStatus(dto));
	}

	// ── NOTIFICATION ENDPOINTS ────────────────────────────────────────

	@SwaggerLcfcNotificationSend()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async notificationSend(@Body() dto: SendLcfcNotificationDto) {
		return parseSuccessResponse(await this.lcfcService.sendNotifications(dto));
	}

	// ── TOKEN ENDPOINTS ───────────────────────────────────────────────

	@SwaggerLcfcTokenValidate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async tokenValidate(@Param('token') token: string) {
		return parseSuccessResponse(await this.lcfcService.validateToken(token));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerLcfcSurveyGetByToken()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyGetByToken(@Body() dto: GetLcfcSurveyByTokenDto) {
		return parseSuccessResponse(await this.lcfcService.getSurveyByToken(dto));
	}

	@SwaggerLcfcSurveyComplete()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyComplete(@Body() dto: CompleteLcfcSurveyDto) {
		return parseSuccessResponse(await this.lcfcService.completeSurvey(dto));
	}

	// ── DASHBOARD ENDPOINTS ───────────────────────────────────────────

	@SwaggerLcfcDashboard()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async dashboardGet(@Body() dto: DashboardLcfcDto) {
		return parseSuccessResponse(await this.lcfcService.getDashboard(dto));
	}
}
