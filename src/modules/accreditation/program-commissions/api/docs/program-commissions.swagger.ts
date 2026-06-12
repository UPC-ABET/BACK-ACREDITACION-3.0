import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { programCommissionsRoutes } from '../../config/program-commissions.routes';
import {
	FilterProgramCommissionDto,
	FilterProgramCommissionDetailedDto,
	CommissionOptionsQueryDto,
	ProgramOptionsQueryDto,
} from '../../model/program-commissions.dtos';

const cfg = programCommissionsRoutes.programCommissions;

export const SwaggerProgramCommissionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProgramCommissionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerProgramCommissionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerProgramCommissionGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProgramCommissionDto });

export const SwaggerProgramCommissionCommissionOptions = () =>
	HttpMethodWithSwagger({ ...cfg.operation.commissionOptions, query: CommissionOptionsQueryDto });

export const SwaggerProgramCommissionProgramOptions = () =>
	HttpMethodWithSwagger({ ...cfg.operation.programOptions, query: ProgramOptionsQueryDto });

export const SwaggerProgramCommissionGetDetailedByFilters = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getDetailedByFilters,
		body: FilterProgramCommissionDetailedDto,
	});
