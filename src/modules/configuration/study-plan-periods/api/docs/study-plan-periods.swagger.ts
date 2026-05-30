import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { studyPlanPeriodsRoutes } from '../../config/study-plan-periods.routes';

const cfg = studyPlanPeriodsRoutes.study_plan_periods;

const periodAndPlanParams = [
	{ name: 'periodId', description: 'academic.academic_periods.id', type: Number },
	{ name: 'studyPlanId', description: 'academic.study_plans.id', type: Number },
];

export const SwaggerStudyPlanPeriodsController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStudyPlanPeriodsAssociate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.associate, params: periodAndPlanParams });

export const SwaggerStudyPlanPeriodsUnassociate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.unassociate, params: periodAndPlanParams });

export const SwaggerStudyPlanPeriodsList = () =>
	HttpMethodWithSwagger({ ...cfg.operation.list, param: { name: 'periodId', type: Number } });
