import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { ApiSchoolHeader } from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import { lcfcRoutes } from '../../config/lcfc.routes';
import {
	GenerateLcfcConfigDto,
	CloneLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
	UpdateLcfcConfigDto,
	SetLcfcDeadlineDto,
	SendLcfcNotificationDto,
	GetLcfcSurveyByTokenDto,
	CompleteLcfcSurveyDto,
	DashboardLcfcDto,
} from '../../model/lcfc.dtos';
import { PerceptionReportDto } from 'src/modules/survey/shared/model/perception-report.dto';

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
export const SwaggerLcfcConfigAvailableSections = () =>
	applyDecorators(
		HttpMethodWithSwagger(cfg.config.availableSections),
		ApiQuery({
			name: 'programId',
			description: 'Program ID (optional)',
			type: Number,
			required: false,
		}),
	);
export const SwaggerLcfcConfigSectionOutcomes = () =>
	applyDecorators(
		HttpMethodWithSwagger(cfg.config.sectionOutcomes),
		ApiQuery({
			name: 'courseSectionId',
			description: 'Course section ID',
			type: Number,
			required: true,
		}),
		ApiQuery({ name: 'programId', description: 'Program ID', type: Number, required: true }),
	);
export const SwaggerLcfcConfigSectionCommissions = () =>
	applyDecorators(
		HttpMethodWithSwagger(cfg.config.sectionCommissions),
		ApiQuery({
			name: 'courseSectionId',
			description: 'Course section ID',
			type: Number,
			required: true,
		}),
		ApiQuery({
			name: 'programId',
			description: 'Program ID (optional)',
			type: Number,
			required: false,
		}),
	);
export const SwaggerLcfcConfigSetDeadline = () =>
	HttpMethodWithSwagger({ ...cfg.config.setDeadline, body: SetLcfcDeadlineDto });
export const SwaggerLcfcNotificationSend = () =>
	HttpMethodWithSwagger({ ...cfg.notification.send, body: SendLcfcNotificationDto });
export const SwaggerLcfcTokenValidate = () =>
	HttpMethodWithSwagger({
		...cfg.token.validate,
		params: [{ name: 'token', description: 'Token UUID de la encuesta LCFC', type: String }],
	});
export const SwaggerLcfcSurveyListByToken = () =>
	HttpMethodWithSwagger({
		...cfg.survey.listByToken,
		params: [
			{ name: 'token', description: 'Token UUID de cualquier encuesta del alumno', type: String },
		],
	});
export const SwaggerLcfcSurveyGetByToken = () =>
	HttpMethodWithSwagger({ ...cfg.survey.getByToken, body: GetLcfcSurveyByTokenDto });
export const SwaggerLcfcSurveyComplete = () =>
	HttpMethodWithSwagger({ ...cfg.survey.complete, body: CompleteLcfcSurveyDto });
export const SwaggerLcfcDashboard = () =>
	HttpMethodWithSwagger({ ...cfg.dashboard.get, body: DashboardLcfcDto });
export const SwaggerLcfcExport = () =>
	applyDecorators(
		HttpMethodWithSwagger(cfg.dashboard.export),
		ApiQuery({ name: 'programId', description: 'Program ID', type: Number, required: false }),
	);
export const SwaggerLcfcReportPdf = () =>
	applyDecorators(
		HttpMethodWithSwagger(cfg.dashboard.reportPdf),
		ApiQuery({ name: 'programId', description: 'Program ID', type: Number, required: false }),
		ApiQuery({
			name: 'lang',
			description: 'Report language (es|en)',
			type: String,
			required: false,
		}),
	);
export const SwaggerLcfcReportPerception = () =>
	HttpMethodWithSwagger({ ...cfg.dashboard.reportPerception, body: PerceptionReportDto });
