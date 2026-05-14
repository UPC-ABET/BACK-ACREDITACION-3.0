import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerTypeGroupController,
	SwaggerTypeGroupCreate,
	SwaggerTypeGroupUpdate,
	SwaggerTypeGroupDelete,
	SwaggerTypeGroupGetAll,
	SwaggerTypeGroupGetById,
	SwaggerTypeGroupGetByFilters,
} from './docs/type-groups.swagger';
import { TypeGroupService } from './type-groups.service';
import { CreateTypeGroupDto, UpdateTypeGroupDto, FilterTypeGroupDto } from '../model/type-groups.dtos';

@SwaggerTypeGroupController()
export class TypeGroupController extends BaseController<TypeGroupService> {
	constructor(private readonly service: TypeGroupService) {
		super(service);
	}

	@SwaggerTypeGroupCreate()
	async create(@Body() dto: CreateTypeGroupDto) {
		return await super.create(dto);
	}

	@SwaggerTypeGroupUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateTypeGroupDto) {
		return await super.update(id, dto);
	}

	@SwaggerTypeGroupDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerTypeGroupGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerTypeGroupGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerTypeGroupGetByFilters()
	async getByFilters(@Body() dto: FilterTypeGroupDto) {
		return await super.getByFilters(dto);
	}
}
