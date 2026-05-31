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

@SwaggerNotificationConfigController()
export class NotificationConfigController extends BaseController<NotificationConfigService> {
	constructor(private readonly service: NotificationConfigService) {
		super(service);
	}

	@SwaggerNotificationConfigCreate()
	async create(@Body() dto: CreateNotificationConfigDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationConfigUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationConfigDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationConfigDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationConfigGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationConfigGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationConfigGetByFilters()
	async getByFilters(@Body() dto: FilterNotificationConfigDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerNotificationConfigsByPeriod()
	async byPeriod(@Query() q: NotificationConfigsByPeriodQueryDto, @Req() req: any) {
		const rows = await this.service.byPeriod(req.user.schoolId, q.periodId);
		return parseSuccessResponse(rows);
	}

	@SwaggerNotificationConfigsUpsert()
	async upsert(@Body() dto: UpsertNotificationConfigDto, @Req() req: any) {
		const row = await this.service.upsert(req.user.schoolId, dto);
		return parseSuccessResponse(row);
	}

	@SwaggerNotificationConfigsSoftDelete()
	async softDelete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
		await this.service.softDelete(req.user.schoolId, id);
		return parseSuccessResponse(null);
	}
}
