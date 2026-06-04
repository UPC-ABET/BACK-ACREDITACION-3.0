import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerOutcomeConfigController,
	SwaggerOutcomeConfigCreate,
	SwaggerOutcomeConfigUpdate,
	SwaggerOutcomeConfigDelete,
	SwaggerOutcomeConfigGetAll,
	SwaggerOutcomeConfigGetById,
	SwaggerOutcomeConfigGetByFilters,
} from './docs/outcome-configs.swagger';
import { OutcomeConfigService } from './outcome-configs.service';
import {
	CreateOutcomeConfigDto,
	UpdateOutcomeConfigDto,
	FilterOutcomeConfigDto,
} from '../model/outcome-configs.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerOutcomeConfigController()
export class OutcomeConfigController extends BaseController<OutcomeConfigService> {
	constructor(private readonly service: OutcomeConfigService) {
		super(service);
	}

	@SwaggerOutcomeConfigCreate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateOutcomeConfigDto) {
		return await super.create(dto);
	}

	@SwaggerOutcomeConfigUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOutcomeConfigDto) {
		return await super.update(id, dto);
	}

	@SwaggerOutcomeConfigDelete()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerOutcomeConfigGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerOutcomeConfigGetById()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerOutcomeConfigGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterOutcomeConfigDto) {
		return await super.getByFilters(dto);
	}
}
