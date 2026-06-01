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

const EVIDENCE_MODULE = 'EVIDENCE';

@SwaggerSurveyController()
export class SurveyController extends BaseController<SurveyService> {
	constructor(private readonly service: SurveyService) {
		super(service);
	}

	@SwaggerSurveyCreate()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async create(@Body() dto: CreateSurveyDto) {
		return await super.create(dto);
	}

	@SwaggerSurveyUpdate()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSurveyDto) {
		return await super.update(id, dto);
	}

	@SwaggerSurveyDelete()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerSurveyGetAll()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerSurveyGetById()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerSurveyGetByFilters()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterSurveyDto) {
		return await super.getByFilters(dto);
	}
}
