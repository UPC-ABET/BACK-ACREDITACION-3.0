import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCampusController,
	SwaggerCampusCreate,
	SwaggerCampusUpdate,
	SwaggerCampusDelete,
	SwaggerCampusGetAll,
	SwaggerCampusGetById,
	SwaggerCampusGetByFilters,
} from './docs/campuses.swagger';
import { CampusService } from './campuses.service';
import { CreateCampusDto, UpdateCampusDto, FilterCampusDto } from '../model/campuses.dtos';

@SwaggerCampusController()
export class CampusController extends BaseController<CampusService> {
	constructor(private readonly service: CampusService) {
		super(service);
	}

	@SwaggerCampusCreate()
	async create(@Body() dto: CreateCampusDto) {
		return await super.create(dto);
	}

	@SwaggerCampusUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateCampusDto) {
		return await super.update(id, dto);
	}

	@SwaggerCampusDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerCampusGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCampusGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerCampusGetByFilters()
	async getByFilters(@Body() dto: FilterCampusDto) {
		return await super.getByFilters(dto);
	}
}
