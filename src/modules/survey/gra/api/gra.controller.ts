import { Body, HttpStatus, Param, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';
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
	SwaggerGraNotificationTemplate,
	SwaggerGraNotificationUploadExcel,
	SwaggerGraNotificationListStudents,
	SwaggerGraNotificationDelete,
	SwaggerGraEmailSend,
	SwaggerGraEmailGetTemplate,
	SwaggerGraEmailUpdateTemplate,
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
	BulkUploadGraNotificationDto,
	UpdateGraEmailTemplateDto,
	ListStudentsGraDto,
	SendGraEmailDto,
	GetSurveyByTokenDto,
	CompleteGraSurveyDto,
	DashboardGraDto,
	ReplicateGraConfigDto,
	ListGraSurveyOutcomesDto,
} from '../model/gra.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { Public } from 'src/modules/auth/protocols/jwt/decorators/public.decorator';

@SwaggerGraController()
export class GraController {
	constructor(private readonly graService: GraService) {}

	@SwaggerGraConfigCreate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configCreate(@Body() dto: CreateGraConfigDto) {
		return parseSuccessResponse(await this.graService.createConfig(dto), HttpStatus.CREATED);
	}

	@SwaggerGraConfigGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configGetAll() {
		return parseSuccessResponse(await this.graService.getAllConfigs());
	}

	@SwaggerGraConfigGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configGetByFilters(@Body() dto: FilterGraConfigDto) {
		return parseSuccessResponse(await this.graService.getAllConfigs(dto));
	}

	@SwaggerGraConfigGetById()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.graService.getConfigById(id));
	}

	@SwaggerGraConfigUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.PUT })
	async configUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGraConfigDto) {
		return parseSuccessResponse(await this.graService.updateConfig(id, dto));
	}

	@SwaggerGraConfigDelete()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.DELETE })
	async configDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.graService.deleteConfig(id));
	}

	@SwaggerGraConfigReplicate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configReplicate(@Body() dto: ReplicateGraConfigDto) {
		return parseSuccessResponse(await this.graService.replicateConfig(dto));
	}

	@SwaggerGraNotificationSave()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async notificationSave(@Body() dto: SaveGraNotificationDto) {
		return parseSuccessResponse(await this.graService.saveNotification(dto));
	}

	@SwaggerGraNotificationTemplate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async notificationTemplate(@Res() res: Response) {
		const { buffer, fileName } = await this.graService.generateNotificationTemplate();
		const encoded = encodeURIComponent(fileName);
		res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`,
		);
		res.setHeader('Content-Length', buffer.length.toString());
		res.end(buffer);
	}

	@SwaggerGraNotificationUploadExcel()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async notificationUploadExcel(@Body() dto: BulkUploadGraNotificationDto) {
		return parseSuccessResponse(await this.graService.bulkUploadNotifications(dto));
	}

	@SwaggerGraNotificationListStudents()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async notificationListStudents(@Body() dto: ListStudentsGraDto) {
		return parseSuccessResponse(await this.graService.listStudents(dto));
	}

	@SwaggerGraNotificationDelete()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.DELETE })
	async notificationDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.graService.deleteNotification(id));
	}

	@SwaggerGraEmailSend()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async emailSend(@Body() dto: SendGraEmailDto) {
		return parseSuccessResponse(await this.graService.sendEmails(dto));
	}

	@SwaggerGraEmailGetTemplate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async emailGetTemplate() {
		return parseSuccessResponse(await this.graService.getEmailTemplateConfig());
	}

	@SwaggerGraEmailUpdateTemplate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.PUT })
	async emailUpdateTemplate(@Body() dto: UpdateGraEmailTemplateDto) {
		return parseSuccessResponse(await this.graService.updateEmailTemplateConfig(dto));
	}

	@SwaggerGraTokenValidate()
	@Public()
	async tokenValidate(@Param('token') token: string) {
		return parseSuccessResponse(await this.graService.validateToken(token));
	}

	@SwaggerGraSurveyGetByToken()
	@Public()
	async surveyGetByToken(@Body() dto: GetSurveyByTokenDto) {
		return parseSuccessResponse(await this.graService.getSurveyByToken(dto));
	}

	@SwaggerGraSurveyComplete()
	@Public()
	async surveyComplete(@Body() dto: CompleteGraSurveyDto) {
		return parseSuccessResponse(await this.graService.completeSurvey(dto));
	}

	@SwaggerGraOutcomesList()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async outcomesList(@Body() dto: ListGraSurveyOutcomesDto) {
		return parseSuccessResponse(await this.graService.listOutcomesForSurvey(dto));
	}

	@SwaggerGraDashboard()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async dashboardGet(@Body() dto: DashboardGraDto) {
		return parseSuccessResponse(await this.graService.getDashboard(dto));
	}
}
