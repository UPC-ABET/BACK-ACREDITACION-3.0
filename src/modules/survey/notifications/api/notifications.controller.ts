import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerNotificationController,
	SwaggerNotificationCreate,
	SwaggerNotificationUpdate,
	SwaggerNotificationDelete,
	SwaggerNotificationGetAll,
	SwaggerNotificationGetById,
	SwaggerNotificationGetByFilters,
} from './docs/notifications.swagger';
import { NotificationService } from './notifications.service';
import {
	CreateNotificationDto,
	UpdateNotificationDto,
	FilterNotificationDto,
} from '../model/notifications.dtos';

@SwaggerNotificationController()
export class NotificationController extends BaseController<NotificationService> {
	constructor(private readonly service: NotificationService) {
		super(service);
	}

	@SwaggerNotificationCreate()
	async create(@Body() dto: CreateNotificationDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationGetByFilters()
	async getByFilters(@Body() dto: FilterNotificationDto) {
		return await super.getByFilters(dto);
	}
}
