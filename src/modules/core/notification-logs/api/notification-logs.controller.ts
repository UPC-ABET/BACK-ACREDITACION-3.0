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
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

const NOTIFICATION_LOG_RELATIONS = ['categoryType', 'statusType'];

@SwaggerNotificationLogController()
export class NotificationLogController extends BaseController<NotificationLogService> {
	constructor(private readonly service: NotificationLogService) {
		super(service);
	}

	@SwaggerNotificationLogGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return parseSuccessResponse(
			await this.service.getAll({ relations: NOTIFICATION_LOG_RELATIONS }),
		);
	}

	@SwaggerNotificationLogGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(
			await this.service.getById(id, { relations: NOTIFICATION_LOG_RELATIONS }),
		);
	}

	@SwaggerNotificationLogGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterNotificationLogDto) {
		return parseSuccessResponse(
			await this.service.getByFilters(dto, { relations: NOTIFICATION_LOG_RELATIONS }),
		);
	}
}
