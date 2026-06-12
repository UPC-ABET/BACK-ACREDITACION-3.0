import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { emailTemplatesRoutes } from '../../config/email-templates.routes';
import {
	CreateEmailTemplateDto,
	UpdateEmailTemplateDto,
	FilterEmailTemplateDto,
} from '../../model/email-templates.dtos';

const cfg = emailTemplatesRoutes.emailTemplates;

export const SwaggerEmailTemplateController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerEmailTemplateCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateEmailTemplateDto });

export const SwaggerEmailTemplateUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateEmailTemplateDto });

export const SwaggerEmailTemplateDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerEmailTemplateGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerEmailTemplateGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerEmailTemplateGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterEmailTemplateDto });

export const SwaggerEmailTemplateGetByCode = () => HttpMethodWithSwagger(cfg.operation.getByCode);
