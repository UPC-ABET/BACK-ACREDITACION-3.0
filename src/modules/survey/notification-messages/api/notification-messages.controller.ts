import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerNotificationMessageController,
	SwaggerNotificationMessageCreate,
	SwaggerNotificationMessageUpdate,
	SwaggerNotificationMessageDelete,
	SwaggerNotificationMessageGetAll,
	SwaggerNotificationMessageGetById,
	SwaggerNotificationMessageGetByFilters,
} from './docs/notification-messages.swagger';
import { NotificationMessageService } from './notification-messages.service';
import { CreateNotificationMessageDto, UpdateNotificationMessageDto, FilterNotificationMessageDto } from '../model/notification-messages.dtos';

@SwaggerNotificationMessageController()
export class NotificationMessageController extends BaseController<NotificationMessageService> {
	constructor(private readonly service: NotificationMessageService) {
		super(service);
	}

	@SwaggerNotificationMessageCreate()
	async create(@Body() dto: CreateNotificationMessageDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationMessageUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateNotificationMessageDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationMessageDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationMessageGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationMessageGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationMessageGetByFilters()
	async getByFilters(@Body() dto: FilterNotificationMessageDto) {
		return await super.getByFilters(dto);
	}
}
