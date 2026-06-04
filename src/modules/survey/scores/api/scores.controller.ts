import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerScoreController,
	SwaggerScoreCreate,
	SwaggerScoreUpdate,
	SwaggerScoreDelete,
	SwaggerScoreGetAll,
	SwaggerScoreGetById,
	SwaggerScoreGetByFilters,
} from './docs/scores.swagger';
import { ScoreService } from './scores.service';
import { CreateScoreDto, UpdateScoreDto, FilterScoreDto } from '../model/scores.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerScoreController()
export class ScoreController extends BaseController<ScoreService> {
	constructor(private readonly service: ScoreService) {
		super(service);
	}

	@SwaggerScoreCreate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateScoreDto) {
		return await super.create(dto);
	}

	@SwaggerScoreUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateScoreDto) {
		return await super.update(id, dto);
	}

	@SwaggerScoreDelete()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerScoreGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerScoreGetById()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerScoreGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterScoreDto) {
		return await super.getByFilters(dto);
	}
}
