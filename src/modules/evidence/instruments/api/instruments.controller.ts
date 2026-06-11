import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerInstrumentController,
	SwaggerInstrumentCreate,
	SwaggerInstrumentUpdate,
	SwaggerInstrumentDelete,
	SwaggerInstrumentGetAll,
	SwaggerInstrumentGetById,
	SwaggerInstrumentGetByFilters,
} from './docs/instruments.swagger';
import { InstrumentService } from './instruments.service';
import {
	CreateInstrumentDto,
	UpdateInstrumentDto,
	FilterInstrumentDto,
} from '../model/instruments.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerInstrumentController()
export class InstrumentController extends BaseController<InstrumentService> {
	constructor(private readonly service: InstrumentService) {
		super(service);
	}

	@SwaggerInstrumentCreate()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateInstrumentDto) {
		return await super.create(dto);
	}

	@SwaggerInstrumentUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInstrumentDto) {
		return await super.update(id, dto);
	}

	@SwaggerInstrumentDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerInstrumentGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerInstrumentGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerInstrumentGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterInstrumentDto) {
		return await super.getByFilters(dto);
	}
}
