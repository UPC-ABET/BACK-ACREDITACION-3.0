import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { processedRvGradesRoutes } from '../../config/processed-rv-grades.routes';
import { FilterProcessedRvGradeDto } from '../../model/processed-rv-grades.dtos';

const cfg = processedRvGradesRoutes.processedRvGrades;

export const SwaggerProcessedRvGradesController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProcessedRvGradesGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProcessedRvGradeDto });

export const SwaggerProcessedRvGradesRebuild = () => HttpMethodWithSwagger(cfg.operation.rebuild);
