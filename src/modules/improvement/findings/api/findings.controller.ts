import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerFindingController,
	SwaggerFindingCreate,
	SwaggerFindingUpdate,
	SwaggerFindingDelete,
	SwaggerFindingGetAll,
	SwaggerFindingGetById,
	SwaggerFindingGetByFilters,
} from './docs/findings.swagger';
import { FindingService } from './findings.service';
import { CreateFindingDto, UpdateFindingDto, FilterFindingDto } from '../model/findings.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerFindingController()
export class FindingController extends BaseController<FindingService> {
	constructor(private readonly service: FindingService) {
		super(service);
	}

	@SwaggerFindingCreate()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateFindingDto) {
		return await super.create(dto);
	}

	@SwaggerFindingUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFindingDto) {
		return await super.update(id, dto);
	}

	@SwaggerFindingDelete()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerFindingGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFindingGetById()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerFindingGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterFindingDto) {
		return await super.getByFilters(dto);
	}
}
