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
	GetSurveyByTokenDto,
	CompleteGraSurveyDto,
	DashboardGraDto,
	ReplicateGraConfigDto,
	ListGraSurveyOutcomesDto,
} from '../../model/gra.dtos';

const cfg = graRoutes;

export const SwaggerGraController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.root });
export const SwaggerGraConfigCreate = () =>
	HttpMethodWithSwagger({ ...cfg.config.create, body: CreateGraConfigDto });
export const SwaggerGraConfigGetAll = () => HttpMethodWithSwagger(cfg.config.getAll);
export const SwaggerGraConfigGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.config.getByFilters, body: FilterGraConfigDto });
export const SwaggerGraConfigGetById = () =>
	HttpMethodWithSwagger({
		...cfg.config.getById,
		params: [{ name: 'id', description: 'ID de la configuración GRA', type: Number }],
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
export const SwaggerGraNotificationDelete = () =>
	HttpMethodWithSwagger({
		...cfg.notification.delete,
		params: [{ name: 'id', description: 'ID de la notificación GRA', type: Number }],
	});
export const SwaggerGraNotificationTemplate = () =>
	HttpMethodWithSwagger({ ...cfg.notification.template, produces: XLSX_CONTENT_TYPE });
export const SwaggerGraNotificationUploadExcel = () =>
	HttpMethodWithSwagger({ ...cfg.notification.uploadExcel, body: BulkUploadGraNotificationDto });
export const SwaggerGraEmailSend = () =>
	HttpMethodWithSwagger({ ...cfg.email.send, body: SendGraEmailDto });
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
