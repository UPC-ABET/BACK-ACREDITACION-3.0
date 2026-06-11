import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { ifcFindingsRoutes } from '../../config/ifc-findings.routes';
import {
	CreateIfcFindingDto,
	UpdateIfcFindingDto,
	FilterIfcFindingDto,
	ListIfcFindingsDto,
	IfcFindingRowDto,
	PatchIfcFindingDto,
	IfcFindingDetailResponseDto,
} from '../../model/ifc-findings.dtos';

const cfg = ifcFindingsRoutes.ifcFindings;

export const SwaggerIfcFindingController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerIfcFindingCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateIfcFindingDto });

export const SwaggerIfcFindingUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateIfcFindingDto });

export const SwaggerIfcFindingDelete = () =>
	HttpMethodWithSwagger({ ...cfg.operation.deleteCascade, param: { name: 'id', type: 'number' } });

export const SwaggerIfcFindingGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerIfcFindingGetById = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getById,
		param: { name: 'id', type: 'number' },
		responseType: IfcFindingDetailResponseDto,
	});

export const SwaggerIfcFindingGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterIfcFindingDto });

export const SwaggerIfcFindingList = () =>
	HttpMethodWithSwagger({
		...cfg.operation.list,
		body: ListIfcFindingsDto,
		responseType: [IfcFindingRowDto],
	});

export const SwaggerIfcFindingPatch = () =>
	HttpMethodWithSwagger({
		...cfg.operation.patch,
		param: { name: 'id', type: 'number' },
		body: PatchIfcFindingDto,
	});
