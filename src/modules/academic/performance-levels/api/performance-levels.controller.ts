import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerPerformanceLevelController,
	SwaggerPerformanceLevelCreate,
	SwaggerPerformanceLevelUpdate,
	SwaggerPerformanceLevelDelete,
	SwaggerPerformanceLevelGetAll,
	SwaggerPerformanceLevelGetById,
	SwaggerPerformanceLevelGetByFilters,
} from './docs/performance-levels.swagger';
import { PerformanceLevelService } from './performance-levels.service';
import {
	CreatePerformanceLevelDto,
	UpdatePerformanceLevelDto,
	FilterPerformanceLevelDto,
} from '../model/performance-levels.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerPerformanceLevelController()
export class PerformanceLevelController extends BaseController<PerformanceLevelService> {
	constructor(private readonly service: PerformanceLevelService) {
		super(service);
	}

	@SwaggerPerformanceLevelCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreatePerformanceLevelDto) {
		return await super.create(dto);
	}

	@SwaggerPerformanceLevelUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePerformanceLevelDto) {
		return await super.update(id, dto);
	}

	@SwaggerPerformanceLevelDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerPerformanceLevelGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerPerformanceLevelGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerPerformanceLevelGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterPerformanceLevelDto) {
		return await super.getByFilters(dto);
	}
}
