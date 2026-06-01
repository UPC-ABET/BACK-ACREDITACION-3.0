import { Body, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import {
	SwaggerNotificationConfigController,
	SwaggerNotificationConfigCreate,
	SwaggerNotificationConfigUpdate,
	SwaggerNotificationConfigDelete,
	SwaggerNotificationConfigGetAll,
	SwaggerNotificationConfigGetById,
	SwaggerNotificationConfigGetByFilters,
	SwaggerNotificationConfigsByPeriod,
	SwaggerNotificationConfigsUpsert,
	SwaggerNotificationConfigsSoftDelete,
} from './docs/notification-configs.swagger';
import { NotificationConfigService } from './notification-configs.service';
import {
	CreateNotificationConfigDto,
	UpdateNotificationConfigDto,
	FilterNotificationConfigDto,
	UpsertNotificationConfigDto,
	NotificationConfigsByPeriodQueryDto,
} from '../model/notification-configs.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ADMIN_MODULE = 'ADMIN';

@SwaggerNotificationConfigController()
export class NotificationConfigController extends BaseController<NotificationConfigService> {
	constructor(private readonly service: NotificationConfigService) {
		super(service);
	}

	@SwaggerNotificationConfigCreate()
	@RequirePermission({ module: ADMIN_MODULE, action: 'POST' })
	async create(@Body() dto: CreateNotificationConfigDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationConfigUpdate()
	@RequirePermission({ module: ADMIN_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationConfigDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationConfigDelete()
	@RequirePermission({ module: ADMIN_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationConfigGetAll()
	@RequirePermission({ module: ADMIN_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationConfigGetById()
	@RequirePermission({ module: ADMIN_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationConfigGetByFilters()
	@RequirePermission({ module: ADMIN_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterNotificationConfigDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerNotificationConfigsByPeriod()
	@RequirePermission({ module: ADMIN_MODULE, action: 'GET' })
	async byPeriod(@Query() q: NotificationConfigsByPeriodQueryDto, @Req() req: any) {
		const rows = await this.service.byPeriod(req.user.schoolId, q.periodId);
		return parseSuccessResponse(rows);
	}

	@SwaggerNotificationConfigsUpsert()
	@RequirePermission({ module: ADMIN_MODULE, action: 'POST' })
	async upsert(@Body() dto: UpsertNotificationConfigDto, @Req() req: any) {
		const row = await this.service.upsert(req.user.schoolId, dto);
		return parseSuccessResponse(row);
	}

	@SwaggerNotificationConfigsSoftDelete()
	@RequirePermission({ module: ADMIN_MODULE, action: 'DELETE' })
	async softDelete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
		await this.service.softDelete(req.user.schoolId, id);
		return parseSuccessResponse(null);
	}
}
