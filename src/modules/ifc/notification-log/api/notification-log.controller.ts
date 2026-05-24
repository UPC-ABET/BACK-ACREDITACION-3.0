import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerNotificationLogController,
	SwaggerNotificationLogCreate,
	SwaggerNotificationLogUpdate,
	SwaggerNotificationLogDelete,
	SwaggerNotificationLogGetAll,
	SwaggerNotificationLogGetById,
	SwaggerNotificationLogGetByFilters,
} from './docs/notification-log.swagger';
import { NotificationLogService } from './notification-log.service';
import {
	CreateNotificationLogDto,
	UpdateNotificationLogDto,
	FilterNotificationLogDto,
} from '../model/notification-log.dtos';

@SwaggerNotificationLogController()
export class NotificationLogController extends BaseController<NotificationLogService> {
	constructor(private readonly service: NotificationLogService) {
		super(service);
	}

	@SwaggerNotificationLogCreate()
	async create(@Body() dto: CreateNotificationLogDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationLogUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationLogDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationLogDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationLogGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationLogGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationLogGetByFilters()
	async getByFilters(@Body() dto: FilterNotificationLogDto) {
		return await super.getByFilters(dto);
	}
}
