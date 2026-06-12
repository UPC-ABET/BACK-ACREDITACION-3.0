import { Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStaffController,
	SwaggerStaffCreate,
	SwaggerStaffUpdate,
	SwaggerStaffDelete,
	SwaggerStaffGetAll,
	SwaggerStaffGetById,
	SwaggerStaffGetByFilters,
	SwaggerStaffLookup,
} from './docs/staff.swagger';
import { StaffService } from './staff.service';
import { CreateStaffDto, UpdateStaffDto, FilterStaffDto } from '../model/staff.dtos';
import { LookupQueryDto } from 'src/commons/lookup.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerStaffController()
export class StaffController extends BaseController<StaffService> {
	constructor(private readonly service: StaffService) {
		super(service);
	}

	@SwaggerStaffCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateStaffDto) {
		return await super.create(dto);
	}

	@SwaggerStaffUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffDto) {
		return await super.update(id, dto);
	}

	@SwaggerStaffDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStaffGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStaffGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStaffGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterStaffDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerStaffLookup()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async lookup(@Query() query: LookupQueryDto) {
		return parseSuccessResponse(await this.service.getLookup(query));
	}
}
