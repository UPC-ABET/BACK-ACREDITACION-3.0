import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { ifcFindingsRoutes } from '../../config/ifc-findings.routes';
import { CreateIfcFindingDto, UpdateIfcFindingDto, FilterIfcFindingDto } from '../../model/ifc-findings.dtos';

const cfg = ifcFindingsRoutes.ifc_findings;

export const SwaggerIfcFindingController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerIfcFindingCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateIfcFindingDto });

export const SwaggerIfcFindingUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateIfcFindingDto });

export const SwaggerIfcFindingDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerIfcFindingGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerIfcFindingGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerIfcFindingGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterIfcFindingDto });
