import { Body, Param, ParseIntPipe } from '@nestjs/common';
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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerProgramController()
export class ProgramController extends BaseController<ProgramService> {
	constructor(private readonly service: ProgramService) {
		super(service);
	}

	@SwaggerProgramCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateProgramDto) {
		return await super.create(dto);
	}

	@SwaggerProgramUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProgramDto) {
		return await super.update(id, dto);
	}

	@SwaggerProgramDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProgramGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProgramGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProgramGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterProgramDto) {
		return await super.getByFilters(dto);
	}
}
