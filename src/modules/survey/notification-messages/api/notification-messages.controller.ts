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

const SURVEY_MODULE = 'SURVEY';

@SwaggerNotificationMessageController()
export class NotificationMessageController extends BaseController<NotificationMessageService> {
	constructor(private readonly service: NotificationMessageService) {
		super(service);
	}

	@SwaggerNotificationMessageCreate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async create(@Body() dto: CreateNotificationMessageDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationMessageUpdate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationMessageDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationMessageDelete()
	@RequirePermission({ module: SURVEY_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationMessageGetAll()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationMessageGetById()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationMessageGetByFilters()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterNotificationMessageDto) {
		return await super.getByFilters(dto);
	}
}
