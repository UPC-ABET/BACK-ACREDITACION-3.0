import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerNotificationConfigController,
	SwaggerNotificationConfigCreate,
	SwaggerNotificationConfigUpdate,
	SwaggerNotificationConfigDelete,
	SwaggerNotificationConfigGetAll,
	SwaggerNotificationConfigGetById,
	SwaggerNotificationConfigGetByFilters,
} from './docs/notification-configs.swagger';
import { NotificationConfigService } from './notification-configs.service';
import { CreateNotificationConfigDto, UpdateNotificationConfigDto, FilterNotificationConfigDto } from '../model/notification-configs.dtos';

@SwaggerNotificationConfigController()
export class NotificationConfigController extends BaseController<NotificationConfigService> {
	constructor(private readonly service: NotificationConfigService) {
		super(service);
	}

	@SwaggerNotificationConfigCreate()
	async create(@Body() dto: CreateNotificationConfigDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationConfigUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateNotificationConfigDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationConfigDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationConfigGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationConfigGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationConfigGetByFilters()
	async getByFilters(@Body() dto: FilterNotificationConfigDto) {
		return await super.getByFilters(dto);
	}
}
