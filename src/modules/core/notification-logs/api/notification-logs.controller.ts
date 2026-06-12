import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerNotificationLogController,
	SwaggerNotificationLogGetAll,
	SwaggerNotificationLogGetById,
	SwaggerNotificationLogGetByFilters,
} from './docs/notification-logs.swagger';
import { NotificationLogService } from './notification-logs.service';
import { FilterNotificationLogDto } from '../model/notification-logs.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

// Read-only: notification logs are append-only audit records written by dispatch code.
@SwaggerNotificationLogController()
export class NotificationLogController extends BaseController<NotificationLogService> {
	constructor(private readonly service: NotificationLogService) {
		super(service);
	}

	@SwaggerNotificationLogGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationLogGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationLogGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterNotificationLogDto) {
		return await super.getByFilters(dto);
	}
}
