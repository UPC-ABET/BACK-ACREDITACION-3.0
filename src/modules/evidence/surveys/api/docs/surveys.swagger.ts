import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { surveysRoutes } from '../../config/surveys.routes';
import { CreateSurveyDto, UpdateSurveyDto, FilterSurveyDto } from '../../model/surveys.dtos';

const cfg = surveysRoutes.surveys;

export const SwaggerSurveyController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerSurveyCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateSurveyDto });

export const SwaggerSurveyUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateSurveyDto });

export const SwaggerSurveyDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerSurveyGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerSurveyGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerSurveyGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterSurveyDto });
