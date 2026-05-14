import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { rubricOutcomeCriteriasRoutes } from '../../config/rubric-outcome-criterias.routes';
import { CreateRubricOutcomeCriteriaDto, UpdateRubricOutcomeCriteriaDto, FilterRubricOutcomeCriteriaDto } from '../../model/rubric-outcome-criterias.dtos';

const cfg = rubricOutcomeCriteriasRoutes.rubric_outcome_criterias;

export const SwaggerRubricOutcomeCriteriaController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerRubricOutcomeCriteriaCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateRubricOutcomeCriteriaDto });

export const SwaggerRubricOutcomeCriteriaUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateRubricOutcomeCriteriaDto });

export const SwaggerRubricOutcomeCriteriaDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerRubricOutcomeCriteriaGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerRubricOutcomeCriteriaGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerRubricOutcomeCriteriaGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterRubricOutcomeCriteriaDto });
