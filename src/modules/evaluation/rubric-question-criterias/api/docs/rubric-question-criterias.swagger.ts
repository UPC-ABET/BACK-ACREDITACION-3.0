import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { rubricQuestionCriteriasRoutes } from '../../config/rubric-question-criterias.routes';
import { CreateRubricQuestionCriteriaDto, UpdateRubricQuestionCriteriaDto, FilterRubricQuestionCriteriaDto } from '../../model/rubric-question-criterias.dtos';

const cfg = rubricQuestionCriteriasRoutes.rubric_question_criterias;

export const SwaggerRubricQuestionCriteriaController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerRubricQuestionCriteriaCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateRubricQuestionCriteriaDto });

export const SwaggerRubricQuestionCriteriaUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateRubricQuestionCriteriaDto });

export const SwaggerRubricQuestionCriteriaDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerRubricQuestionCriteriaGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerRubricQuestionCriteriaGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerRubricQuestionCriteriaGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterRubricQuestionCriteriaDto });
