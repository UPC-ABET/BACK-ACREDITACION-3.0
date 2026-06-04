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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerNotificationLogController()
export class NotificationLogController extends BaseController<NotificationLogService> {
	constructor(private readonly service: NotificationLogService) {
		super(service);
	}

	@SwaggerNotificationLogCreate()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateNotificationLogDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationLogUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationLogDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationLogDelete()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationLogGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationLogGetById()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationLogGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterNotificationLogDto) {
		return await super.getByFilters(dto);
	}
}
