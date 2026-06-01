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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerProfessorController()
export class ProfessorController extends BaseController<ProfessorService> {
	constructor(private readonly service: ProfessorService) {
		super(service);
	}

	@SwaggerProfessorCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateProfessorDto) {
		return await super.create(dto);
	}

	@SwaggerProfessorUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProfessorDto) {
		return await super.update(id, dto);
	}

	@SwaggerProfessorDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProfessorGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProfessorGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProfessorGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterProfessorDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerProfessorGetByUserId()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getByUserId(@Param('id', ParseIntPipe) userId: number) {
		return parseSuccessResponse(await this.service.getByUserId(userId));
	}
}
