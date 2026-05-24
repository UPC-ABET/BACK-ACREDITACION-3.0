import { Body, Param } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { LcfcConfigService } from './lcfc-config.service';
import { LcfcNotificationService } from './lcfc-notification.service';
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

@SwaggerLcfcController()
export class LcfcController {
	constructor(
		private readonly configService: LcfcConfigService,
		private readonly notifService: LcfcNotificationService,
	) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerLcfcConfigGenerate()
	async configGenerate(@Body() dto: GenerateLcfcConfigDto) {
		return parseSuccessResponse(await this.configService.generateConfigs(dto));
	}

	@SwaggerLcfcConfigGetAll()
	async configGetAll() {
		return parseSuccessResponse(await this.configService.getAll());
	}

	@SwaggerLcfcConfigGetByFilters()
	async configGetByFilters(@Body() dto: FilterLcfcConfigDto) {
		return parseSuccessResponse(await this.configService.getAll(dto));
	}

	@SwaggerLcfcConfigUpdateStatus()
	async configUpdateStatus(@Body() dto: UpdateLcfcConfigStatusDto) {
		return parseSuccessResponse(await this.configService.updateStatus(dto));
	}

	// ── NOTIFICATION ENDPOINTS ────────────────────────────────────────

	@SwaggerLcfcNotificationSend()
	async notificationSend(@Body() dto: SendLcfcNotificationDto) {
		return parseSuccessResponse(await this.notifService.sendNotifications(dto));
	}

	// ── TOKEN ENDPOINTS ───────────────────────────────────────────────

	@SwaggerLcfcTokenValidate()
	async tokenValidate(@Param('token') token: string) {
		return parseSuccessResponse(await this.notifService.validateToken(token));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerLcfcSurveyGetByToken()
	async surveyGetByToken(@Body() dto: GetLcfcSurveyByTokenDto) {
		return parseSuccessResponse(await this.notifService.getSurveyByToken(dto));
	}

	@SwaggerLcfcSurveyComplete()
	async surveyComplete(@Body() dto: CompleteLcfcSurveyDto) {
		return parseSuccessResponse(await this.notifService.completeSurvey(dto));
	}

	// ── DASHBOARD ENDPOINTS ───────────────────────────────────────────

	@SwaggerLcfcDashboard()
	async dashboardGet(@Body() dto: DashboardLcfcDto) {
		return parseSuccessResponse(await this.notifService.getDashboard(dto));
	}
}
