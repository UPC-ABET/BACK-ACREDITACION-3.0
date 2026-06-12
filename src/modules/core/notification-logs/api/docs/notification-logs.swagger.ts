import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { notificationLogsRoutes } from '../../config/notification-logs.routes';
import { FilterNotificationLogDto } from '../../model/notification-logs.dtos';

const cfg = notificationLogsRoutes.notificationLogs;

export const SwaggerNotificationLogController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerNotificationLogGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerNotificationLogGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerNotificationLogGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterNotificationLogDto });
