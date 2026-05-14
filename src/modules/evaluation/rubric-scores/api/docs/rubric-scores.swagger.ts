import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { rubricScoresRoutes } from '../../config/rubric-scores.routes';
import { CreateRubricScoreDto, UpdateRubricScoreDto, FilterRubricScoreDto } from '../../model/rubric-scores.dtos';

const cfg = rubricScoresRoutes.rubric_scores;

export const SwaggerRubricScoreController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerRubricScoreCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateRubricScoreDto });

export const SwaggerRubricScoreUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateRubricScoreDto });

export const SwaggerRubricScoreDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerRubricScoreGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerRubricScoreGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerRubricScoreGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterRubricScoreDto });
