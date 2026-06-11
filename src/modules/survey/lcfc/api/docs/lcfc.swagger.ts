import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { lcfcRoutes } from '../../config/lcfc.routes';
import {
	GenerateLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
	SendLcfcNotificationDto,
	GetLcfcSurveyByTokenDto,
	CompleteLcfcSurveyDto,
	DashboardLcfcDto,
} from '../../model/lcfc.dtos';

const cfg = lcfcRoutes;

export const SwaggerLcfcController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.root });

// ── CONFIG ──
export const SwaggerLcfcConfigGenerate = () =>
	HttpMethodWithSwagger({ ...cfg.config.generate, body: GenerateLcfcConfigDto });
export const SwaggerLcfcConfigGetAll = () => HttpMethodWithSwagger(cfg.config.getAll);
export const SwaggerLcfcConfigGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.config.getByFilters, body: FilterLcfcConfigDto });
export const SwaggerLcfcConfigUpdateStatus = () =>
	HttpMethodWithSwagger({ ...cfg.config.updateStatus, body: UpdateLcfcConfigStatusDto });

// ── NOTIFICATION ──
export const SwaggerLcfcNotificationSend = () =>
	HttpMethodWithSwagger({ ...cfg.notification.send, body: SendLcfcNotificationDto });

// ── TOKEN ──
export const SwaggerLcfcTokenValidate = () =>
	HttpMethodWithSwagger({
		...cfg.token.validate,
		params: [{ name: 'token', description: 'Token UUID de la encuesta LCFC', type: String }],
	});

// ── SURVEY ──
export const SwaggerLcfcSurveyGetByToken = () =>
	HttpMethodWithSwagger({ ...cfg.survey.getByToken, body: GetLcfcSurveyByTokenDto });
export const SwaggerLcfcSurveyComplete = () =>
	HttpMethodWithSwagger({ ...cfg.survey.complete, body: CompleteLcfcSurveyDto });

// ── DASHBOARD ──
export const SwaggerLcfcDashboard = () =>
	HttpMethodWithSwagger({ ...cfg.dashboard.get, body: DashboardLcfcDto });
