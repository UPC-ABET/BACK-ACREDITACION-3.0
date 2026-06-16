import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { plannerSessionRoutes } from '../../config/planner-session.routes';

const cfg = plannerSessionRoutes.session;

export const SwaggerPlannerSessionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerPlannerSessionStatus = () => HttpMethodWithSwagger(cfg.operation.status);

export const SwaggerPlannerSessionRefresh = () => HttpMethodWithSwagger(cfg.operation.refresh);
