import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerFindingOutcomeController,
	SwaggerFindingOutcomeCreate,
	SwaggerFindingOutcomeUpdate,
	SwaggerFindingOutcomeDelete,
	SwaggerFindingOutcomeGetAll,
	SwaggerFindingOutcomeGetById,
	SwaggerFindingOutcomeGetByFilters,
} from './docs/finding-outcomes.swagger';
import { FindingOutcomeService } from './finding-outcomes.service';
import {
	CreateFindingOutcomeDto,
	UpdateFindingOutcomeDto,
	FilterFindingOutcomeDto,
} from '../model/finding-outcomes.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerFindingOutcomeController()
export class FindingOutcomeController extends BaseController<FindingOutcomeService> {
	constructor(private readonly service: FindingOutcomeService) {
		super(service);
	}

	@SwaggerFindingOutcomeCreate()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateFindingOutcomeDto) {
		return await super.create(dto);
	}

	@SwaggerFindingOutcomeUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFindingOutcomeDto) {
		return await super.update(id, dto);
	}

	@SwaggerFindingOutcomeDelete()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerFindingOutcomeGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFindingOutcomeGetById()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerFindingOutcomeGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterFindingOutcomeDto) {
		return await super.getByFilters(dto);
	}
}
