import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { programsRoutes } from '../../config/programs.routes';
import { CreateProgramDto, UpdateProgramDto, FilterProgramDto } from '../../model/programs.dtos';

const cfg = programsRoutes.programs;

export const SwaggerProgramController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProgramCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateProgramDto });

export const SwaggerProgramUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateProgramDto });

export const SwaggerProgramDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerProgramGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerProgramGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerProgramGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProgramDto });
