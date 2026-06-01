import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerChartController,
	SwaggerChartCreate,
	SwaggerChartUpdate,
	SwaggerChartDelete,
	SwaggerChartGetAll,
	SwaggerChartGetById,
	SwaggerChartGetByFilters,
} from './docs/charts.swagger';
import { ChartService } from './charts.service';
import { CreateChartDto, UpdateChartDto, FilterChartDto } from '../model/charts.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ORGANIZATION_MODULE = 'ORGANIZATION';

@SwaggerChartController()
export class ChartController extends BaseController<ChartService> {
	constructor(private readonly service: ChartService) {
		super(service);
	}

	@SwaggerChartCreate()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async create(@Body() dto: CreateChartDto) {
		return await super.create(dto);
	}

	@SwaggerChartUpdate()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChartDto) {
		return await super.update(id, dto);
	}

	@SwaggerChartDelete()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerChartGetAll()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerChartGetById()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerChartGetByFilters()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterChartDto) {
		return await super.getByFilters(dto);
	}
}
