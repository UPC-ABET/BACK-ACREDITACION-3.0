import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { GraConfigService } from './gra-config.service';
import { GraNotificationService } from './gra-notification.service';
import {
	SwaggerGraController,
	SwaggerGraConfigCreate,
	SwaggerGraConfigGetAll,
	SwaggerGraConfigGetByFilters,
	SwaggerGraConfigGetById,
	SwaggerGraConfigUpdate,
	SwaggerGraConfigDelete,
	SwaggerGraConfigReplicate,
	SwaggerGraNotificationSave,
	SwaggerGraNotificationListStudents,
	SwaggerGraNotificationDelete,
	SwaggerGraEmailSend,
	SwaggerGraTokenValidate,
	SwaggerGraSurveyGetByToken,
	SwaggerGraSurveyComplete,
	SwaggerGraOutcomesList,
	SwaggerGraDashboard,
} from './docs/gra.swagger';
import {
	CreateGraConfigDto,
	UpdateGraConfigDto,
	FilterGraConfigDto,
	SaveGraNotificationDto,
	ListStudentsGraDto,
	SendGraEmailDto,
	GetSurveyByTokenDto,
	CompleteGraSurveyDto,
	DashboardGraDto,
	ReplicateGraConfigDto,
	ListGraSurveyOutcomesDto,
} from '../model/gra.dtos';

@SwaggerGraController()
export class GraController {
	constructor(
		private readonly configService: GraConfigService,
		private readonly notifService: GraNotificationService,
	) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerGraConfigCreate()
	async configCreate(@Body() dto: CreateGraConfigDto) {
		return parseSuccessResponse(await this.configService.create(dto));
	}

	@SwaggerGraConfigGetAll()
	async configGetAll() {
		return parseSuccessResponse(await this.configService.getAll());
	}

	@SwaggerGraConfigGetByFilters()
	async configGetByFilters(@Body() dto: FilterGraConfigDto) {
		return parseSuccessResponse(await this.configService.getAll(dto));
	}

	@SwaggerGraConfigGetById()
	async configGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.configService.getById(id));
	}

	@SwaggerGraConfigUpdate()
	async configUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGraConfigDto) {
		return parseSuccessResponse(await this.configService.update(id, dto));
	}

	@SwaggerGraConfigDelete()
	async configDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.configService.delete(id));
	}

	@SwaggerGraConfigReplicate()
	async configReplicate(@Body() dto: ReplicateGraConfigDto) {
		return parseSuccessResponse(await this.configService.replicate(dto));
	}

	// ── NOTIFICATION ENDPOINTS ────────────────────────────────────────

	@SwaggerGraNotificationSave()
	async notificationSave(@Body() dto: SaveGraNotificationDto) {
		return parseSuccessResponse(await this.notifService.saveNotification(dto));
	}

	@SwaggerGraNotificationListStudents()
	async notificationListStudents(@Body() dto: ListStudentsGraDto) {
		return parseSuccessResponse(await this.notifService.listStudents(dto));
	}

	@SwaggerGraNotificationDelete()
	async notificationDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.notifService.deleteNotification(id));
	}

	// ── EMAIL ENDPOINTS ───────────────────────────────────────────────

	@SwaggerGraEmailSend()
	async emailSend(@Body() dto: SendGraEmailDto) {
		return parseSuccessResponse(await this.notifService.sendEmails(dto));
	}

	// ── TOKEN ENDPOINTS ───────────────────────────────────────────────

	@SwaggerGraTokenValidate()
	async tokenValidate(@Param('token') token: string) {
		return parseSuccessResponse(await this.notifService.validateToken(token));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerGraSurveyGetByToken()
	async surveyGetByToken(@Body() dto: GetSurveyByTokenDto) {
		return parseSuccessResponse(await this.notifService.getSurveyByToken(dto));
	}

	@SwaggerGraSurveyComplete()
	async surveyComplete(@Body() dto: CompleteGraSurveyDto) {
		return parseSuccessResponse(await this.notifService.completeSurvey(dto));
	}

	// ── OUTCOMES ENDPOINTS ────────────────────────────────────────────

	@SwaggerGraOutcomesList()
	async outcomesList(@Body() dto: ListGraSurveyOutcomesDto) {
		return parseSuccessResponse(await this.configService.listOutcomesForSurvey(dto));
	}

	// ── DASHBOARD ENDPOINTS ───────────────────────────────────────────

	@SwaggerGraDashboard()
	async dashboardGet(@Body() dto: DashboardGraDto) {
		return parseSuccessResponse(await this.notifService.getDashboard(dto));
	}
}
