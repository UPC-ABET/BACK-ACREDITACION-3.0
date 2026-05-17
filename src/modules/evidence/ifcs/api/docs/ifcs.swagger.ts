import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { ifcsRoutes } from '../../config/ifcs.routes';
import { CreateIfcDto, UpdateIfcDto, FilterIfcDto, ListIfcsDto, RejectIfcDto, IfcViewResponseDto } from '../../model/ifcs.dtos';

const cfg = ifcsRoutes.ifcs;

export const SwaggerIfcController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerIfcCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateIfcDto });

export const SwaggerIfcUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateIfcDto });

export const SwaggerIfcDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerIfcGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerIfcGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterIfcDto });

export const SwaggerIfcList = () => HttpMethodWithSwagger({ ...cfg.operation.list, body: ListIfcsDto });

export const SwaggerIfcGetView = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getById,
		param: { name: 'id', type: 'number' },
		responseType: IfcViewResponseDto,
	});

export const SwaggerIfcSubmit = () =>
	HttpMethodWithSwagger({
		...cfg.operation.submit,
		param: { name: 'id', type: 'number' },
	});

export const SwaggerIfcApprove = () =>
	HttpMethodWithSwagger({
		...cfg.operation.approve,
		param: { name: 'id', type: 'number' },
	});

export const SwaggerIfcReject = () =>
	HttpMethodWithSwagger({
		...cfg.operation.reject,
		param: { name: 'id', type: 'number' },
		body: RejectIfcDto,
	});
