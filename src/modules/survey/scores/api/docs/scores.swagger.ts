import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { scoresRoutes } from '../../config/scores.routes';
import { CreateScoreDto, UpdateScoreDto, FilterScoreDto } from '../../model/scores.dtos';

const cfg = scoresRoutes.scores;

export const SwaggerScoreController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerScoreCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateScoreDto });

export const SwaggerScoreUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateScoreDto });

export const SwaggerScoreDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerScoreGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerScoreGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerScoreGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterScoreDto });
