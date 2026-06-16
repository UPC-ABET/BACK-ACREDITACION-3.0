import { applyDecorators } from '@nestjs/common';
import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { ApiSchoolHeader } from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import { lcfcRoutes } from '../../config/lcfc.routes';
import {
	GenerateLcfcConfigDto,
	CloneLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
	UpdateLcfcConfigDto,
	SendLcfcNotificationDto,
	GetLcfcSurveyByTokenDto,
	CompleteLcfcSurveyDto,
	DashboardLcfcDto,
} from '../../model/lcfc.dtos';

const cfg = lcfcRoutes;

export const SwaggerLcfcController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.root });
export const SwaggerLcfcConfigGenerate = () =>
	applyDecorators(
		HttpMethodWithSwagger({ ...cfg.config.generate, body: GenerateLcfcConfigDto }),
		ApiSchoolHeader(),
	);
export const SwaggerLcfcConfigGetAll = () => HttpMethodWithSwagger(cfg.config.getAll);
export const SwaggerLcfcConfigGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.config.getByFilters, body: FilterLcfcConfigDto });
export const SwaggerLcfcConfigGetById = () =>
	HttpMethodWithSwagger({
		...cfg.config.getById,
		params: [
			{ name: 'id', description: 'LCFC configuration ID (outcome_config.id)', type: Number },
		],
	});
export const SwaggerLcfcConfigUpdate = () =>
	HttpMethodWithSwagger({
		...cfg.config.update,
		params: [
			{ name: 'id', description: 'LCFC configuration ID (outcome_config.id)', type: Number },
		],
		body: UpdateLcfcConfigDto,
	});
export const SwaggerLcfcConfigUpdateStatus = () =>
	HttpMethodWithSwagger({ ...cfg.config.updateStatus, body: UpdateLcfcConfigStatusDto });
export const SwaggerLcfcConfigClone = () =>
	HttpMethodWithSwagger({ ...cfg.config.clone, body: CloneLcfcConfigDto });
export const SwaggerLcfcConfigDelete = () =>
	HttpMethodWithSwagger({
		...cfg.config.delete,
		params: [
			{ name: 'id', description: 'LCFC configuration ID (outcome_config.id)', type: Number },
		],
	});
export const SwaggerLcfcNotificationSend = () =>
	HttpMethodWithSwagger({ ...cfg.notification.send, body: SendLcfcNotificationDto });
export const SwaggerLcfcTokenValidate = () =>
	HttpMethodWithSwagger({
		...cfg.token.validate,
		params: [{ name: 'token', description: 'Token UUID de la encuesta LCFC', type: String }],
	});
export const SwaggerLcfcSurveyGetByToken = () =>
	HttpMethodWithSwagger({ ...cfg.survey.getByToken, body: GetLcfcSurveyByTokenDto });
export const SwaggerLcfcSurveyComplete = () =>
	HttpMethodWithSwagger({ ...cfg.survey.complete, body: CompleteLcfcSurveyDto });
export const SwaggerLcfcDashboard = () =>
	HttpMethodWithSwagger({ ...cfg.dashboard.get, body: DashboardLcfcDto });
