import { Body, Param } from '@nestjs/common';
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

@SwaggerInstrumentController()
export class InstrumentController extends BaseController<InstrumentService> {
	constructor(private readonly service: InstrumentService) {
		super(service);
	}

	@SwaggerInstrumentCreate()
	async create(@Body() dto: CreateInstrumentDto) {
		return await super.create(dto);
	}

	@SwaggerInstrumentUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateInstrumentDto) {
		return await super.update(id, dto);
	}

	@SwaggerInstrumentDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerInstrumentGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerInstrumentGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerInstrumentGetByFilters()
	async getByFilters(@Body() dto: FilterInstrumentDto) {
		return await super.getByFilters(dto);
	}
}
