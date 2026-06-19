import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { notificationConfigsRoutes } from '../../config/notification-configs.routes';
import {
	CreateNotificationConfigDto,
	UpdateNotificationConfigDto,
	FilterNotificationConfigDto,
	UpsertNotificationConfigDto,
	NotificationConfigViewDto,
} from '../../model/notification-configs.dtos';

const cfg = notificationConfigsRoutes.notificationConfigs;

export const SwaggerNotificationConfigController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerNotificationConfigCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateNotificationConfigDto });

export const SwaggerNotificationConfigUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateNotificationConfigDto });

export const SwaggerNotificationConfigDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerNotificationConfigGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerNotificationConfigGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerNotificationConfigGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterNotificationConfigDto });

export const SwaggerNotificationConfigsList = () =>
	HttpMethodWithSwagger({
		...cfg.operation.list,
		responseType: NotificationConfigViewDto,
	});

export const SwaggerNotificationConfigsUpsert = () =>
	HttpMethodWithSwagger({
		...cfg.operation.upsert,
		body: UpsertNotificationConfigDto,
		responseType: NotificationConfigViewDto,
	});

export const SwaggerNotificationConfigsSoftDelete = () =>
	HttpMethodWithSwagger({
		...cfg.operation.softDelete,
		param: { name: 'id', type: 'number' },
	});
