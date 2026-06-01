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

const SURVEY_MODULE = 'SURVEY';

@SwaggerNotificationController()
export class NotificationController extends BaseController<NotificationService> {
	constructor(private readonly service: NotificationService) {
		super(service);
	}

	@SwaggerNotificationCreate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async create(@Body() dto: CreateNotificationDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationUpdate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationDelete()
	@RequirePermission({ module: SURVEY_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationGetAll()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationGetById()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationGetByFilters()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterNotificationDto) {
		return await super.getByFilters(dto);
	}
}
