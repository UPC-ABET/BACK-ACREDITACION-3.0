import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { staffRoutes } from '../../config/staff.routes';
import { CreateStaffDto, UpdateStaffDto, FilterStaffDto } from '../../model/staff.dtos';
import { LookupQueryDto } from 'src/commons/lookup.dtos';

const cfg = staffRoutes.staff;

export const SwaggerStaffController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStaffCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateStaffDto });

export const SwaggerStaffUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateStaffDto });

export const SwaggerStaffDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerStaffGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerStaffGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerStaffGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterStaffDto });

export const SwaggerStaffLookup = () =>
	HttpMethodWithSwagger({ ...cfg.operation.lookup, query: LookupQueryDto });
