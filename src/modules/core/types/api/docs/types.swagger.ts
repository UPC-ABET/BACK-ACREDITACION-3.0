import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { typesRoutes } from '../../config/types.routes';
import {
	CreateTypeDto,
	UpdateTypeDto,
	FilterTypeDto,
	SetCanEvaluateDto,
} from '../../model/types.dtos';

const cfg = typesRoutes.types;

export const SwaggerTypeController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerTypeCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateTypeDto });

export const SwaggerTypeUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateTypeDto });

export const SwaggerTypeDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerTypeGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerTypeGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerTypeGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterTypeDto });

export const SwaggerTypesByGroupCode = () =>
	HttpMethodWithSwagger({
		...cfg.operation.byGroupCode,
		param: { name: 'code', type: 'string' },
	});

export const SwaggerTypeSetCanEvaluate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.setCanEvaluate,
		param: { name: 'id', type: 'number' },
		body: SetCanEvaluateDto,
	});
