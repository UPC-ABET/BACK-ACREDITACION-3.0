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

const EVIDENCE_MODULE = 'EVIDENCE';

@SwaggerInstrumentController()
export class InstrumentController extends BaseController<InstrumentService> {
	constructor(private readonly service: InstrumentService) {
		super(service);
	}

	@SwaggerInstrumentCreate()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async create(@Body() dto: CreateInstrumentDto) {
		return await super.create(dto);
	}

	@SwaggerInstrumentUpdate()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInstrumentDto) {
		return await super.update(id, dto);
	}

	@SwaggerInstrumentDelete()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerInstrumentGetAll()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerInstrumentGetById()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerInstrumentGetByFilters()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterInstrumentDto) {
		return await super.getByFilters(dto);
	}
}
