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

const SURVEY_MODULE = 'SURVEY';

@SwaggerOutcomeConfigController()
export class OutcomeConfigController extends BaseController<OutcomeConfigService> {
	constructor(private readonly service: OutcomeConfigService) {
		super(service);
	}

	@SwaggerOutcomeConfigCreate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async create(@Body() dto: CreateOutcomeConfigDto) {
		return await super.create(dto);
	}

	@SwaggerOutcomeConfigUpdate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOutcomeConfigDto) {
		return await super.update(id, dto);
	}

	@SwaggerOutcomeConfigDelete()
	@RequirePermission({ module: SURVEY_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerOutcomeConfigGetAll()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerOutcomeConfigGetById()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerOutcomeConfigGetByFilters()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterOutcomeConfigDto) {
		return await super.getByFilters(dto);
	}
}
