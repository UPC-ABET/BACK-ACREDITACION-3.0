import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';
import { pppRoutes } from '../../config/ppp.routes';
import {
	CreatePppConfigDto,
	UpdatePppConfigDto,
	FilterPppConfigDto,
	ReplicatePppConfigDto,
	CreatePppSurveyDto,
	FilterPppSurveyDto,
	UploadPppExcelDto,
	DashboardPppDto,
	GenerateFindingsPppDto,
} from '../../model/ppp.dtos';

const cfg = pppRoutes;

export const SwaggerPppController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.root });
export const SwaggerPppConfigCreate = () =>
	HttpMethodWithSwagger({ ...cfg.config.create, body: CreatePppConfigDto });
export const SwaggerPppConfigGetAll = () => HttpMethodWithSwagger(cfg.config.getAll);
export const SwaggerPppConfigGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.config.getByFilters, body: FilterPppConfigDto });
export const SwaggerPppConfigGetById = () =>
	HttpMethodWithSwagger({
		...cfg.config.getById,
		params: [{ name: 'id', description: 'ID de la configuración PPP', type: Number }],
	});
export const SwaggerPppConfigUpdate = () =>
	HttpMethodWithSwagger({
		...cfg.config.update,
		body: UpdatePppConfigDto,
		params: [{ name: 'id', description: 'ID de la configuración PPP', type: Number }],
	});
export const SwaggerPppConfigDelete = () =>
	HttpMethodWithSwagger({
		...cfg.config.delete,
		params: [{ name: 'id', description: 'ID de la configuración PPP', type: Number }],
	});
export const SwaggerPppConfigReplicate = () =>
	HttpMethodWithSwagger({ ...cfg.config.replicate, body: ReplicatePppConfigDto });
export const SwaggerPppSurveyCreate = () =>
	HttpMethodWithSwagger({ ...cfg.survey.create, body: CreatePppSurveyDto });
export const SwaggerPppSurveyGetAll = () => HttpMethodWithSwagger(cfg.survey.getAll);
export const SwaggerPppSurveyGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.survey.getByFilters, body: FilterPppSurveyDto });
export const SwaggerPppSurveyGetById = () =>
	HttpMethodWithSwagger({
		...cfg.survey.getById,
		params: [{ name: 'id', description: 'ID de la encuesta PPP', type: Number }],
	});
export const SwaggerPppSurveyUploadExcel = () =>
	HttpMethodWithSwagger({ ...cfg.survey.uploadExcel, body: UploadPppExcelDto });
export const SwaggerPppSurveyTemplate = () =>
	HttpMethodWithSwagger({ ...cfg.survey.template, produces: XLSX_CONTENT_TYPE });
export const SwaggerPppSurveyDashboard = () =>
	HttpMethodWithSwagger({ ...cfg.survey.dashboard, body: DashboardPppDto });
export const SwaggerPppSurveyGenerateFindings = () =>
	HttpMethodWithSwagger({ ...cfg.survey.generateFindings, body: GenerateFindingsPppDto });
