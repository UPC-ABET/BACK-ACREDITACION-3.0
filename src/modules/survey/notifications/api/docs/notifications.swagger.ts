import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { notificationsRoutes } from '../../config/notifications.routes';
import { CreateNotificationDto, UpdateNotificationDto, FilterNotificationDto } from '../../model/notifications.dtos';

const cfg = notificationsRoutes.notifications;

export const SwaggerNotificationController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerNotificationCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateNotificationDto });

export const SwaggerNotificationUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateNotificationDto });

export const SwaggerNotificationDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerNotificationGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerNotificationGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerNotificationGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterNotificationDto });
