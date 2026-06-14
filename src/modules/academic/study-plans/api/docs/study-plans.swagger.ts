import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { studyPlansRoutes } from '../../config/study-plans.routes';
import {
	CreateStudyPlanDto,
	UpdateStudyPlanDto,
	FilterStudyPlanDto,
	StudyPlanMaintenanceQueryDto,
	UpdateStudyPlanMaintenanceDto,
	CreateStudyPlanMaintenanceDto,
} from '../../model/study-plans.dtos';

const cfg = studyPlansRoutes.studyPlans;

export const SwaggerStudyPlanController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStudyPlanCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateStudyPlanDto });

export const SwaggerStudyPlanUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateStudyPlanDto });

export const SwaggerStudyPlanDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerStudyPlanGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerStudyPlanGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerStudyPlanGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterStudyPlanDto });

export const SwaggerStudyPlanMaintenanceCreate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceCreate,
		body: CreateStudyPlanMaintenanceDto,
	});

export const SwaggerStudyPlanMaintenanceList = () =>
	HttpMethodWithSwagger({ ...cfg.operation.maintenanceList, query: StudyPlanMaintenanceQueryDto });

export const SwaggerStudyPlanMaintenanceUpdate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceUpdate,
		body: UpdateStudyPlanMaintenanceDto,
	});

export const SwaggerStudyPlanMaintenanceDelete = () =>
	HttpMethodWithSwagger(cfg.operation.maintenanceDelete);

export const SwaggerStudyPlanCoursesView = () => HttpMethodWithSwagger(cfg.operation.coursesView);
