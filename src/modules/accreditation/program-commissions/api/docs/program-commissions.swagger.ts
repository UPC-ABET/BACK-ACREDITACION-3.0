import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { programCommissionsRoutes } from '../../config/program-commissions.routes';
import { CreateProgramCommissionDto, UpdateProgramCommissionDto, FilterProgramCommissionDto } from '../../model/program-commissions.dtos';

const cfg = programCommissionsRoutes.program_commissions;

export const SwaggerProgramCommissionController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProgramCommissionCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateProgramCommissionDto });

export const SwaggerProgramCommissionUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateProgramCommissionDto });

export const SwaggerProgramCommissionDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerProgramCommissionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerProgramCommissionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerProgramCommissionGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProgramCommissionDto });
