import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { notificationMessagesRoutes } from '../../config/notification-messages.routes';
import {
	CreateNotificationMessageDto,
	UpdateNotificationMessageDto,
	FilterNotificationMessageDto,
} from '../../model/notification-messages.dtos';

const cfg = notificationMessagesRoutes.notificationMessages;

export const SwaggerNotificationMessageController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerNotificationMessageCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateNotificationMessageDto });

export const SwaggerNotificationMessageUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateNotificationMessageDto });

export const SwaggerNotificationMessageDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerNotificationMessageGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerNotificationMessageGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerNotificationMessageGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterNotificationMessageDto });
