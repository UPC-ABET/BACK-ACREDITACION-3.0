import { Body, Param, ParseIntPipe, Query } from '@nestjs/common';
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
import {
	SchoolId,
	ApiSchoolHeader,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerNotificationConfigController()
export class NotificationConfigController extends BaseController<NotificationConfigService> {
	constructor(private readonly service: NotificationConfigService) {
		super(service);
	}

	@SwaggerNotificationConfigCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateNotificationConfigDto) {
		return await super.create(dto);
	}

	@SwaggerNotificationConfigUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNotificationConfigDto) {
		return await super.update(id, dto);
	}

	@SwaggerNotificationConfigDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerNotificationConfigGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerNotificationConfigGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerNotificationConfigGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterNotificationConfigDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerNotificationConfigsByPeriod()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async byPeriod(@Query() q: NotificationConfigsByPeriodQueryDto, @SchoolId() schoolId: number) {
		const rows = await this.service.byPeriod(schoolId, q.periodId);
		return parseSuccessResponse(rows);
	}

	@SwaggerNotificationConfigsUpsert()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async upsert(@Body() dto: UpsertNotificationConfigDto, @SchoolId() schoolId: number) {
		const row = await this.service.upsert(schoolId, dto);
		return parseSuccessResponse(row);
	}

	@SwaggerNotificationConfigsSoftDelete()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.DELETE })
	async softDelete(@Param('id', ParseIntPipe) id: number, @SchoolId() schoolId: number) {
		await this.service.softDelete(schoolId, id);
		return parseSuccessResponse(null);
	}
}
