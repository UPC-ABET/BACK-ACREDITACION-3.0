import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { classRepresentativesRoutes } from '../../config/class-representatives.routes';
import {
	AssignRepresentativeDto,
	ClassRepresentativeMaintenanceQueryDto,
} from '../../model/class-representatives.dtos';

const cfg = classRepresentativesRoutes;

export const SwaggerClassRepresentativeController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerClassRepresentativeGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerClassRepresentativeAssign = () =>
	HttpMethodWithSwagger({ ...cfg.operation.assign, body: AssignRepresentativeDto });

export const SwaggerClassRepresentativeRemove = () =>
	HttpMethodWithSwagger({ ...cfg.operation.remove, body: AssignRepresentativeDto });

export const SwaggerClassRepresentativeMaintenance = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenance,
		query: ClassRepresentativeMaintenanceQueryDto,
	});
