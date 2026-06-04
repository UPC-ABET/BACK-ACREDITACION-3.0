import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerAccreditorController,
	SwaggerAccreditorCreate,
	SwaggerAccreditorUpdate,
	SwaggerAccreditorDelete,
	SwaggerAccreditorGetAll,
	SwaggerAccreditorGetById,
	SwaggerAccreditorGetByFilters,
} from './docs/accreditors.swagger';
import { AccreditorService } from './accreditors.service';
import {
	CreateAccreditorDto,
	UpdateAccreditorDto,
	FilterAccreditorDto,
} from '../model/accreditors.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerAccreditorController()
export class AccreditorController extends BaseController<AccreditorService> {
	constructor(private readonly service: AccreditorService) {
		super(service);
	}

	@SwaggerAccreditorCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateAccreditorDto) {
		return await super.create(dto);
	}

	@SwaggerAccreditorUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccreditorDto) {
		return await super.update(id, dto);
	}

	@SwaggerAccreditorDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerAccreditorGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerAccreditorGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerAccreditorGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterAccreditorDto) {
		return await super.getByFilters(dto);
	}
}
