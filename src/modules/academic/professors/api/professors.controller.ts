import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProfessorController,
	SwaggerProfessorCreate,
	SwaggerProfessorUpdate,
	SwaggerProfessorDelete,
	SwaggerProfessorGetAll,
	SwaggerProfessorGetById,
	SwaggerProfessorGetByFilters,
	SwaggerProfessorGetByUserId,
} from './docs/professors.swagger';
import { ProfessorService } from './professors.service';
import {
	CreateProfessorDto,
	UpdateProfessorDto,
	FilterProfessorDto,
} from '../model/professors.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';

@SwaggerProfessorController()
export class ProfessorController extends BaseController<ProfessorService> {
	constructor(private readonly service: ProfessorService) {
		super(service);
	}

	@SwaggerProfessorCreate()
	async create(@Body() dto: CreateProfessorDto) {
		return await super.create(dto);
	}

	@SwaggerProfessorUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProfessorDto) {
		return await super.update(id, dto);
	}

	@SwaggerProfessorDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProfessorGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProfessorGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProfessorGetByFilters()
	async getByFilters(@Body() dto: FilterProfessorDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerProfessorGetByUserId()
	async getByUserId(@Param('id', ParseIntPipe) userId: number) {
		return parseSuccessResponse(await this.service.getByUserId(userId));
	}
}
