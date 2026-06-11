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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerNotificationController()
export class NotificationController extends BaseController<NotificationService> {
	constructor(private readonly service: NotificationService) {
		super(service);
	}

	@SwaggerNotificationCreate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateNotificationDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationDelete()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationGetById()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterNotificationDto) {
		return await super.getByFilters(dto);
	}
}
