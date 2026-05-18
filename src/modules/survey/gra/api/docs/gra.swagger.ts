import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { graRoutes } from '../../config/gra.routes';
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
} from '../../model/gra.dtos';

const cfg = graRoutes;

export const SwaggerGraController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.root });

// ── CONFIG ──
export const SwaggerGraConfigCreate = () => HttpMethodWithSwagger({ ...cfg.config.create, body: CreateGraConfigDto });
export const SwaggerGraConfigGetAll = () => HttpMethodWithSwagger(cfg.config.getAll);
export const SwaggerGraConfigGetByFilters = () => HttpMethodWithSwagger({ ...cfg.config.getByFilters, body: FilterGraConfigDto });
export const SwaggerGraConfigGetById = () => HttpMethodWithSwagger({ ...cfg.config.getById, params: [{ name: 'id', description: 'ID de la configuración GRA', type: Number }] });
export const SwaggerGraConfigUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.config.update, body: UpdateGraConfigDto, params: [{ name: 'id', description: 'ID de la configuración GRA', type: Number }] });
export const SwaggerGraConfigDelete = () => HttpMethodWithSwagger({ ...cfg.config.delete, params: [{ name: 'id', description: 'ID de la configuración GRA', type: Number }] });

// ── NOTIFICATION ──
export const SwaggerGraNotificationSave = () => HttpMethodWithSwagger({ ...cfg.notification.save, body: SaveGraNotificationDto });
export const SwaggerGraNotificationListStudents = () => HttpMethodWithSwagger({ ...cfg.notification.listStudents, body: ListStudentsGraDto });
export const SwaggerGraNotificationDelete = () => HttpMethodWithSwagger({ ...cfg.notification.delete, params: [{ name: 'id', description: 'ID de la notificación GRA', type: Number }] });

// ── EMAIL ──
export const SwaggerGraEmailSend = () => HttpMethodWithSwagger({ ...cfg.email.send, body: SendGraEmailDto });

// ── TOKEN ──
export const SwaggerGraTokenValidate = () => HttpMethodWithSwagger({ ...cfg.token.validate, params: [{ name: 'token', description: 'Token UUID de la encuesta GRA', type: String }] });

// ── SURVEY ──
export const SwaggerGraSurveyGetByToken = () => HttpMethodWithSwagger({ ...cfg.survey.getByToken, body: GetSurveyByTokenDto });
export const SwaggerGraSurveyComplete = () => HttpMethodWithSwagger({ ...cfg.survey.complete, body: CompleteGraSurveyDto });

// ── DASHBOARD ──
export const SwaggerGraDashboard = () => HttpMethodWithSwagger({ ...cfg.dashboard.get, body: DashboardGraDto });
