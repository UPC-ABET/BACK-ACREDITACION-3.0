import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { GraService } from './gra.service';
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
	constructor(private readonly graService: GraService) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerGraConfigCreate()
	async configCreate(@Body() dto: CreateGraConfigDto) {
		return parseSuccessResponse(await this.graService.create(dto), HttpStatus.CREATED);
	}

	@SwaggerGraConfigGetAll()
	async configGetAll() {
		return parseSuccessResponse(await this.graService.getAll());
	}

	@SwaggerGraConfigGetByFilters()
	async configGetByFilters(@Body() dto: FilterGraConfigDto) {
		return parseSuccessResponse(await this.graService.getAll(dto));
	}

	@SwaggerGraConfigGetById()
	async configGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.graService.getById(id));
	}

	@SwaggerGraConfigUpdate()
	async configUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGraConfigDto) {
		return parseSuccessResponse(await this.graService.update(id, dto));
	}

	@SwaggerGraConfigDelete()
	async configDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.graService.delete(id));
	}

	@SwaggerGraConfigReplicate()
	async configReplicate(@Body() dto: ReplicateGraConfigDto) {
		return parseSuccessResponse(await this.graService.replicate(dto));
	}

	// ── NOTIFICATION ENDPOINTS ────────────────────────────────────────

	@SwaggerGraNotificationSave()
	async notificationSave(@Body() dto: SaveGraNotificationDto) {
		return parseSuccessResponse(await this.graService.saveNotification(dto));
	}

	@SwaggerGraNotificationListStudents()
	async notificationListStudents(@Body() dto: ListStudentsGraDto) {
		return parseSuccessResponse(await this.graService.listStudents(dto));
	}

	@SwaggerGraNotificationDelete()
	async notificationDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.graService.deleteNotification(id));
	}

	// ── EMAIL ENDPOINTS ───────────────────────────────────────────────

	@SwaggerGraEmailSend()
	async emailSend(@Body() dto: SendGraEmailDto) {
		return parseSuccessResponse(await this.graService.sendEmails(dto));
	}

	// ── TOKEN ENDPOINTS ───────────────────────────────────────────────

	@SwaggerGraTokenValidate()
	async tokenValidate(@Param('token') token: string) {
		return parseSuccessResponse(await this.graService.validateToken(token));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerGraSurveyGetByToken()
	async surveyGetByToken(@Body() dto: GetSurveyByTokenDto) {
		return parseSuccessResponse(await this.graService.getSurveyByToken(dto));
	}

	@SwaggerGraSurveyComplete()
	async surveyComplete(@Body() dto: CompleteGraSurveyDto) {
		return parseSuccessResponse(await this.graService.completeSurvey(dto));
	}

	// ── OUTCOMES ENDPOINTS ────────────────────────────────────────────

	@SwaggerGraOutcomesList()
	async outcomesList(@Body() dto: ListGraSurveyOutcomesDto) {
		return parseSuccessResponse(await this.graService.listOutcomesForSurvey(dto));
	}

	// ── DASHBOARD ENDPOINTS ───────────────────────────────────────────

	@SwaggerGraDashboard()
	async dashboardGet(@Body() dto: DashboardGraDto) {
		return parseSuccessResponse(await this.graService.getDashboard(dto));
	}
}
