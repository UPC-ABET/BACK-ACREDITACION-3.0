import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { programCommissionsRoutes } from '../../config/program-commissions.routes';
import { FilterProgramCommissionDto } from '../../model/program-commissions.dtos';

const cfg = programCommissionsRoutes.programCommissions;

export const SwaggerProgramCommissionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProgramCommissionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerProgramCommissionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerProgramCommissionGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProgramCommissionDto });
