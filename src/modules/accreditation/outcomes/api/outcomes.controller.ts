import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerOutcomeController,
	SwaggerOutcomeCreate,
	SwaggerOutcomeUpdate,
	SwaggerOutcomeDelete,
	SwaggerOutcomeGetAll,
	SwaggerOutcomeGetById,
	SwaggerOutcomeGetByFilters,
} from './docs/outcomes.swagger';
import { OutcomeService } from './outcomes.service';
import { CreateOutcomeDto, UpdateOutcomeDto, FilterOutcomeDto } from '../model/outcomes.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerOutcomeController()
export class OutcomeController extends BaseController<OutcomeService> {
	constructor(private readonly service: OutcomeService) {
		super(service);
	}

	@SwaggerOutcomeCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateOutcomeDto) {
		return await super.create(dto);
	}

	@SwaggerOutcomeUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOutcomeDto) {
		return await super.update(id, dto);
	}

	@SwaggerOutcomeDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerOutcomeGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerOutcomeGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.getById(id));
	}

	@SwaggerOutcomeGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterOutcomeDto) {
		return await super.getByFilters(dto);
	}
}
