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

const SURVEY_MODULE = 'SURVEY';

@SwaggerLcfcController()
export class LcfcController {
	constructor(private readonly lcfcService: LcfcService) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerLcfcConfigGenerate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async configGenerate(@Body() dto: GenerateLcfcConfigDto) {
		return parseSuccessResponse(await this.lcfcService.generateConfigs(dto));
	}

	@SwaggerLcfcConfigGetAll()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async configGetAll() {
		return parseSuccessResponse(await this.lcfcService.getAllConfigs());
	}

	@SwaggerLcfcConfigGetByFilters()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async configGetByFilters(@Body() dto: FilterLcfcConfigDto) {
		return parseSuccessResponse(await this.lcfcService.getAllConfigs(dto));
	}

	@SwaggerLcfcConfigUpdateStatus()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async configUpdateStatus(@Body() dto: UpdateLcfcConfigStatusDto) {
		return parseSuccessResponse(await this.lcfcService.updateConfigStatus(dto));
	}

	// ── NOTIFICATION ENDPOINTS ────────────────────────────────────────

	@SwaggerLcfcNotificationSend()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async notificationSend(@Body() dto: SendLcfcNotificationDto) {
		return parseSuccessResponse(await this.lcfcService.sendNotifications(dto));
	}

	// ── TOKEN ENDPOINTS ───────────────────────────────────────────────

	@SwaggerLcfcTokenValidate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async tokenValidate(@Param('token') token: string) {
		return parseSuccessResponse(await this.lcfcService.validateToken(token));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerLcfcSurveyGetByToken()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async surveyGetByToken(@Body() dto: GetLcfcSurveyByTokenDto) {
		return parseSuccessResponse(await this.lcfcService.getSurveyByToken(dto));
	}

	@SwaggerLcfcSurveyComplete()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async surveyComplete(@Body() dto: CompleteLcfcSurveyDto) {
		return parseSuccessResponse(await this.lcfcService.completeSurvey(dto));
	}

	// ── DASHBOARD ENDPOINTS ───────────────────────────────────────────

	@SwaggerLcfcDashboard()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async dashboardGet(@Body() dto: DashboardLcfcDto) {
		return parseSuccessResponse(await this.lcfcService.getDashboard(dto));
	}
}
