import { Body, Param, ParseIntPipe } from '@nestjs/common';
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
import {
	CreateNotificationMessageDto,
	UpdateNotificationMessageDto,
	FilterNotificationMessageDto,
} from '../model/notification-messages.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerNotificationMessageController()
export class NotificationMessageController extends BaseController<NotificationMessageService> {
	constructor(private readonly service: NotificationMessageService) {
		super(service);
	}

	@SwaggerNotificationMessageCreate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateNotificationMessageDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationMessageUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationMessageDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationMessageDelete()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationMessageGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationMessageGetById()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationMessageGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterNotificationMessageDto) {
		return await super.getByFilters(dto);
	}
}
