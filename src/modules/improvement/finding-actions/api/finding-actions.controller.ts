import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerFindingActionController,
	SwaggerFindingActionCreate,
	SwaggerFindingActionUpdate,
	SwaggerFindingActionDelete,
	SwaggerFindingActionGetAll,
	SwaggerFindingActionGetById,
	SwaggerFindingActionGetByFilters,
} from './docs/finding-actions.swagger';
import { FindingActionService } from './finding-actions.service';
import {
	CreateFindingActionDto,
	UpdateFindingActionDto,
	FilterFindingActionDto,
} from '../model/finding-actions.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const IMPROVEMENT_MODULE = 'IMPROVEMENT';

@SwaggerFindingActionController()
export class FindingActionController extends BaseController<FindingActionService> {
	constructor(private readonly service: FindingActionService) {
		super(service);
	}

	@SwaggerFindingActionCreate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async create(@Body() dto: CreateFindingActionDto) {
		return await super.create(dto);
	}

	@SwaggerFindingActionUpdate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFindingActionDto) {
		return await super.update(id, dto);
	}

	@SwaggerFindingActionDelete()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerFindingActionGetAll()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFindingActionGetById()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerFindingActionGetByFilters()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterFindingActionDto) {
		return await super.getByFilters(dto);
	}
}
