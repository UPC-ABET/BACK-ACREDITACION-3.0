import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerActionController,
	SwaggerActionCreate,
	SwaggerActionUpdate,
	SwaggerActionDelete,
	SwaggerActionGetAll,
	SwaggerActionGetById,
	SwaggerActionGetByFilters,
} from './docs/actions.swagger';
import { ActionService } from './actions.service';
import { CreateActionDto, UpdateActionDto, FilterActionDto } from '../model/actions.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const IMPROVEMENT_MODULE = 'IMPROVEMENT';

@SwaggerActionController()
export class ActionController extends BaseController<ActionService> {
	constructor(private readonly service: ActionService) {
		super(service);
	}

	@SwaggerActionCreate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async create(@Body() dto: CreateActionDto) {
		return await super.create(dto);
	}

	@SwaggerActionUpdate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActionDto) {
		return await super.update(id, dto);
	}

	@SwaggerActionDelete()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerActionGetAll()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerActionGetById()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerActionGetByFilters()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterActionDto) {
		return await super.getByFilters(dto);
	}
}
