import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { rubricQuestionsRoutes } from '../../config/rubric-questions.routes';
import { CreateRubricQuestionDto, UpdateRubricQuestionDto, FilterRubricQuestionDto } from '../../model/rubric-questions.dtos';

const cfg = rubricQuestionsRoutes.rubric_questions;

export const SwaggerRubricQuestionController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerRubricQuestionCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateRubricQuestionDto });

export const SwaggerRubricQuestionUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateRubricQuestionDto });

export const SwaggerRubricQuestionDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerRubricQuestionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerRubricQuestionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerRubricQuestionGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterRubricQuestionDto });
