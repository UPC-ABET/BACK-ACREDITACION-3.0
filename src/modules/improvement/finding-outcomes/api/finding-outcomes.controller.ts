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

const IMPROVEMENT_MODULE = 'IMPROVEMENT';

@SwaggerFindingOutcomeController()
export class FindingOutcomeController extends BaseController<FindingOutcomeService> {
	constructor(private readonly service: FindingOutcomeService) {
		super(service);
	}

	@SwaggerFindingOutcomeCreate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async create(@Body() dto: CreateFindingOutcomeDto) {
		return await super.create(dto);
	}

	@SwaggerFindingOutcomeUpdate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFindingOutcomeDto) {
		return await super.update(id, dto);
	}

	@SwaggerFindingOutcomeDelete()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerFindingOutcomeGetAll()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFindingOutcomeGetById()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerFindingOutcomeGetByFilters()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterFindingOutcomeDto) {
		return await super.getByFilters(dto);
	}
}
