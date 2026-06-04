import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerSurveyController,
	SwaggerSurveyCreate,
	SwaggerSurveyUpdate,
	SwaggerSurveyDelete,
	SwaggerSurveyGetAll,
	SwaggerSurveyGetById,
	SwaggerSurveyGetByFilters,
} from './docs/surveys.swagger';
import { SurveyService } from './surveys.service';
import { CreateSurveyDto, UpdateSurveyDto, FilterSurveyDto } from '../model/surveys.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerSurveyController()
export class SurveyController extends BaseController<SurveyService> {
	constructor(private readonly service: SurveyService) {
		super(service);
	}

	@SwaggerSurveyCreate()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateSurveyDto) {
		return await super.create(dto);
	}

	@SwaggerSurveyUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSurveyDto) {
		return await super.update(id, dto);
	}

	@SwaggerSurveyDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerSurveyGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerSurveyGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerSurveyGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterSurveyDto) {
		return await super.getByFilters(dto);
	}
}
