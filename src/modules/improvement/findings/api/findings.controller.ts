import { Body, Param } from '@nestjs/common';
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

@SwaggerFindingController()
export class FindingController extends BaseController<FindingService> {
	constructor(private readonly service: FindingService) {
		super(service);
	}

	@SwaggerFindingCreate()
	async create(@Body() dto: CreateFindingDto) {
		return await super.create(dto);
	}

	@SwaggerFindingUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateFindingDto) {
		return await super.update(id, dto);
	}

	@SwaggerFindingDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerFindingGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerFindingGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerFindingGetByFilters()
	async getByFilters(@Body() dto: FilterFindingDto) {
		return await super.getByFilters(dto);
	}
}
