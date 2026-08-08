import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';
import { graRoutes } from '../../config/gra.routes';
import {
	CreateGraConfigDto,
	UpdateGraConfigDto,
	FilterGraConfigDto,
	SaveGraNotificationDto,
	BulkUploadGraNotificationDto,
	UpdateGraEmailTemplateDto,
	ListStudentsGraDto,
	SendGraEmailDto,
	ResendGraNotificationDto,
	GetSurveyByTokenDto,
	CompleteGraSurveyDto,
	DashboardGraDto,
	ReplicateGraConfigDto,
	ListGraSurveyOutcomesDto,
	SearchGraStudentsDto,
} from '../../model/gra.dtos';
import { PerceptionReportDto } from 'src/modules/survey/shared/model/perception-report.dto';
import { OutcomeConfigResponseDto } from 'src/modules/survey/outcome-configs/model/outcome-configs.dtos';

const cfg = graRoutes;

export const SwaggerGraController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.root });
export const SwaggerGraConfigCreate = () =>
	HttpMethodWithSwagger({ ...cfg.config.create, body: CreateGraConfigDto });
export const SwaggerGraConfigGetAll = () =>
	HttpMethodWithSwagger({ ...cfg.config.getAll, responseType: [OutcomeConfigResponseDto] });
export const SwaggerGraConfigGetByFilters = () =>
	HttpMethodWithSwagger({
		...cfg.config.getByFilters,
		body: FilterGraConfigDto,
		responseType: [OutcomeConfigResponseDto],
	});
export const SwaggerGraConfigGetById = () =>
	HttpMethodWithSwagger({
		...cfg.config.getById,
		params: [{ name: 'id', description: 'ID de la configuración GRA', type: Number }],
		responseType: OutcomeConfigResponseDto,
	});
export const SwaggerGraConfigUpdate = () =>
	HttpMethodWithSwagger({
		...cfg.config.update,
		body: UpdateGraConfigDto,
		params: [{ name: 'id', description: 'ID de la configuración GRA', type: Number }],
	});
export const SwaggerGraConfigDelete = () =>
	HttpMethodWithSwagger({
		...cfg.config.delete,
		params: [{ name: 'id', description: 'ID de la configuración GRA', type: Number }],
	});
export const SwaggerGraConfigReplicate = () =>
	HttpMethodWithSwagger({ ...cfg.config.replicate, body: ReplicateGraConfigDto });
export const SwaggerGraNotificationSave = () =>
	HttpMethodWithSwagger({ ...cfg.notification.save, body: SaveGraNotificationDto });
export const SwaggerGraNotificationListStudents = () =>
	HttpMethodWithSwagger({ ...cfg.notification.listStudents, body: ListStudentsGraDto });
export const SwaggerGraNotificationSearchStudents = () =>
	HttpMethodWithSwagger({ ...cfg.notification.searchStudents, body: SearchGraStudentsDto });
export const SwaggerGraNotificationDelete = () =>
	HttpMethodWithSwagger({
		...cfg.notification.delete,
		params: [{ name: 'id', description: 'ID de la notificación GRA', type: Number }],
	});
export const SwaggerGraNotificationResend = () =>
	HttpMethodWithSwagger({
		...cfg.notification.resend,
		body: ResendGraNotificationDto,
		params: [{ name: 'id', description: 'ID de la notificación GRA', type: Number }],
	});
export const SwaggerGraNotificationTemplate = () =>
	HttpMethodWithSwagger({ ...cfg.notification.template, produces: XLSX_CONTENT_TYPE });
export const SwaggerGraNotificationUploadExcel = () =>
	HttpMethodWithSwagger({ ...cfg.notification.uploadExcel, body: BulkUploadGraNotificationDto });
export const SwaggerGraNotificationExport = () =>
	HttpMethodWithSwagger({ ...cfg.notification.export, produces: XLSX_CONTENT_TYPE });
export const SwaggerGraEmailSummary = () =>
	HttpMethodWithSwagger({ ...cfg.email.summary, body: SendGraEmailDto });
export const SwaggerGraEmailSend = () =>
	HttpMethodWithSwagger({ ...cfg.email.send, body: SendGraEmailDto });
export const SwaggerGraEmailSendStatus = () =>
	HttpMethodWithSwagger({
		...cfg.email.sendStatus,
		params: [{ name: 'jobId', description: 'ID del proceso de envío GRA', type: String }],
	});
export const SwaggerGraEmailGetTemplate = () => HttpMethodWithSwagger(cfg.email.getTemplate);
export const SwaggerGraEmailUpdateTemplate = () =>
	HttpMethodWithSwagger({ ...cfg.email.updateTemplate, body: UpdateGraEmailTemplateDto });
export const SwaggerGraTokenValidate = () =>
	HttpMethodWithSwagger({
		...cfg.token.validate,
		params: [{ name: 'token', description: 'Token UUID de la encuesta GRA', type: String }],
	});
export const SwaggerGraSurveyGetByToken = () =>
	HttpMethodWithSwagger({ ...cfg.survey.getByToken, body: GetSurveyByTokenDto });
export const SwaggerGraSurveyComplete = () =>
	HttpMethodWithSwagger({ ...cfg.survey.complete, body: CompleteGraSurveyDto });
export const SwaggerGraOutcomesList = () =>
	HttpMethodWithSwagger({ ...cfg.outcomes.list, body: ListGraSurveyOutcomesDto });
export const SwaggerGraDashboard = () =>
	HttpMethodWithSwagger({ ...cfg.dashboard.get, body: DashboardGraDto });
export const SwaggerGraExport = () =>
	HttpMethodWithSwagger({ ...cfg.dashboard.export, produces: XLSX_CONTENT_TYPE });
export const SwaggerGraReportPerception = () =>
	HttpMethodWithSwagger({ ...cfg.report.perception, body: PerceptionReportDto });
