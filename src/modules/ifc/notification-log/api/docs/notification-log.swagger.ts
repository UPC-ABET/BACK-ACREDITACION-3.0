import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { notificationLogRoutes } from '../../config/notification-log.routes';
import {
	CreateNotificationLogDto,
	UpdateNotificationLogDto,
	FilterNotificationLogDto,
} from '../../model/notification-log.dtos';

const cfg = notificationLogRoutes.notificationLog;

export const SwaggerNotificationLogController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerNotificationLogCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateNotificationLogDto });

export const SwaggerNotificationLogUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateNotificationLogDto });

export const SwaggerNotificationLogDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerNotificationLogGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerNotificationLogGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerNotificationLogGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterNotificationLogDto });
