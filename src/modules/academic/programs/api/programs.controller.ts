import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProgramController,
	SwaggerProgramCreate,
	SwaggerProgramUpdate,
	SwaggerProgramDelete,
	SwaggerProgramGetAll,
	SwaggerProgramGetById,
	SwaggerProgramGetByFilters,
} from './docs/programs.swagger';
import { ProgramService } from './programs.service';
import { CreateProgramDto, UpdateProgramDto, FilterProgramDto } from '../model/programs.dtos';

@SwaggerProgramController()
export class ProgramController extends BaseController<ProgramService> {
	constructor(private readonly service: ProgramService) {
		super(service);
	}

	@SwaggerProgramCreate()
	async create(@Body() dto: CreateProgramDto) {
		return await super.create(dto);
	}

	@SwaggerProgramUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateProgramDto) {
		return await super.update(id, dto);
	}

	@SwaggerProgramDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerProgramGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProgramGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerProgramGetByFilters()
	async getByFilters(@Body() dto: FilterProgramDto) {
		return await super.getByFilters(dto);
	}
}
