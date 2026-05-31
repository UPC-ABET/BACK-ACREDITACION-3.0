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

@SwaggerLcfcController()
export class LcfcController {
	constructor(private readonly lcfcService: LcfcService) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerLcfcConfigGenerate()
	async configGenerate(@Body() dto: GenerateLcfcConfigDto) {
		return parseSuccessResponse(await this.lcfcService.generateConfigs(dto));
	}

	@SwaggerLcfcConfigGetAll()
	async configGetAll() {
		return parseSuccessResponse(await this.lcfcService.getAllConfigs());
	}

	@SwaggerLcfcConfigGetByFilters()
	async configGetByFilters(@Body() dto: FilterLcfcConfigDto) {
		return parseSuccessResponse(await this.lcfcService.getAllConfigs(dto));
	}

	@SwaggerLcfcConfigUpdateStatus()
	async configUpdateStatus(@Body() dto: UpdateLcfcConfigStatusDto) {
		return parseSuccessResponse(await this.lcfcService.updateStatus(dto));
	}

	// ── NOTIFICATION ENDPOINTS ────────────────────────────────────────

	@SwaggerLcfcNotificationSend()
	async notificationSend(@Body() dto: SendLcfcNotificationDto) {
		return parseSuccessResponse(await this.lcfcService.sendNotifications(dto));
	}

	// ── TOKEN ENDPOINTS ───────────────────────────────────────────────

	@SwaggerLcfcTokenValidate()
	async tokenValidate(@Param('token') token: string) {
		return parseSuccessResponse(await this.lcfcService.validateToken(token));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerLcfcSurveyGetByToken()
	async surveyGetByToken(@Body() dto: GetLcfcSurveyByTokenDto) {
		return parseSuccessResponse(await this.lcfcService.getSurveyByToken(dto));
	}

	@SwaggerLcfcSurveyComplete()
	async surveyComplete(@Body() dto: CompleteLcfcSurveyDto) {
		return parseSuccessResponse(await this.lcfcService.completeSurvey(dto));
	}

	// ── DASHBOARD ENDPOINTS ───────────────────────────────────────────

	@SwaggerLcfcDashboard()
	async dashboardGet(@Body() dto: DashboardLcfcDto) {
		return parseSuccessResponse(await this.lcfcService.getDashboard(dto));
	}
}
