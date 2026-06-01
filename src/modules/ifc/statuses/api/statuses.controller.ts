import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStatusController,
	SwaggerStatusCreate,
	SwaggerStatusUpdate,
	SwaggerStatusDelete,
	SwaggerStatusGetAll,
	SwaggerStatusGetById,
	SwaggerStatusGetByFilters,
} from './docs/statuses.swagger';
import { StatusService } from './statuses.service';
import { CreateStatusDto, UpdateStatusDto, FilterStatusDto } from '../model/statuses.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const IFCS_MODULE = 'IFCS';

@SwaggerStatusController()
export class StatusController extends BaseController<StatusService> {
	constructor(private readonly service: StatusService) {
		super(service);
	}

	@SwaggerStatusCreate()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async create(@Body() dto: CreateStatusDto) {
		return await super.create(dto);
	}

	@SwaggerStatusUpdate()
	@RequirePermission({ module: IFCS_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatusDto) {
		return await super.update(id, dto);
	}

	@SwaggerStatusDelete()
	@RequirePermission({ module: IFCS_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStatusGetAll()
	@RequirePermission({ module: IFCS_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStatusGetById()
	@RequirePermission({ module: IFCS_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStatusGetByFilters()
	@RequirePermission({ module: IFCS_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterStatusDto) {
		return await super.getByFilters(dto);
	}
}
