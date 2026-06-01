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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const SURVEY_MODULE = 'SURVEY';

@SwaggerGraController()
export class GraController {
	constructor(private readonly graService: GraService) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerGraConfigCreate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async configCreate(@Body() dto: CreateGraConfigDto) {
		return parseSuccessResponse(await this.graService.createConfig(dto), HttpStatus.CREATED);
	}

	@SwaggerGraConfigGetAll()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async configGetAll() {
		return parseSuccessResponse(await this.graService.getAllConfigs());
	}

	@SwaggerGraConfigGetByFilters()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async configGetByFilters(@Body() dto: FilterGraConfigDto) {
		return parseSuccessResponse(await this.graService.getAllConfigs(dto));
	}

	@SwaggerGraConfigGetById()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async configGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.graService.getConfigById(id));
	}

	@SwaggerGraConfigUpdate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'PUT' })
	async configUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGraConfigDto) {
		return parseSuccessResponse(await this.graService.updateConfig(id, dto));
	}

	@SwaggerGraConfigDelete()
	@RequirePermission({ module: SURVEY_MODULE, action: 'DELETE' })
	async configDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.graService.deleteConfig(id));
	}

	@SwaggerGraConfigReplicate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async configReplicate(@Body() dto: ReplicateGraConfigDto) {
		return parseSuccessResponse(await this.graService.replicateConfig(dto));
	}

	// ── NOTIFICATION ENDPOINTS ────────────────────────────────────────

	@SwaggerGraNotificationSave()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async notificationSave(@Body() dto: SaveGraNotificationDto) {
		return parseSuccessResponse(await this.graService.saveNotification(dto));
	}

	@SwaggerGraNotificationListStudents()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async notificationListStudents(@Body() dto: ListStudentsGraDto) {
		return parseSuccessResponse(await this.graService.listStudents(dto));
	}

	@SwaggerGraNotificationDelete()
	@RequirePermission({ module: SURVEY_MODULE, action: 'DELETE' })
	async notificationDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.graService.deleteNotification(id));
	}

	// ── EMAIL ENDPOINTS ───────────────────────────────────────────────

	@SwaggerGraEmailSend()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async emailSend(@Body() dto: SendGraEmailDto) {
		return parseSuccessResponse(await this.graService.sendEmails(dto));
	}

	// ── TOKEN ENDPOINTS ───────────────────────────────────────────────

	@SwaggerGraTokenValidate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async tokenValidate(@Param('token') token: string) {
		return parseSuccessResponse(await this.graService.validateToken(token));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerGraSurveyGetByToken()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async surveyGetByToken(@Body() dto: GetSurveyByTokenDto) {
		return parseSuccessResponse(await this.graService.getSurveyByToken(dto));
	}

	@SwaggerGraSurveyComplete()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async surveyComplete(@Body() dto: CompleteGraSurveyDto) {
		return parseSuccessResponse(await this.graService.completeSurvey(dto));
	}

	// ── OUTCOMES ENDPOINTS ────────────────────────────────────────────

	@SwaggerGraOutcomesList()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async outcomesList(@Body() dto: ListGraSurveyOutcomesDto) {
		return parseSuccessResponse(await this.graService.listOutcomesForSurvey(dto));
	}

	// ── DASHBOARD ENDPOINTS ───────────────────────────────────────────

	@SwaggerGraDashboard()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async dashboardGet(@Body() dto: DashboardGraDto) {
		return parseSuccessResponse(await this.graService.getDashboard(dto));
	}
}
