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
	SwaggerProgramByModality,
} from './docs/programs.swagger';
import { ProgramService } from './programs.service';
import { CreateProgramDto, UpdateProgramDto, FilterProgramDto } from '../model/programs.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	ModalityTypeId,
	ApiModalityTypeHeader,
} from 'src/modules/auth/protocols/jwt/decorators/modality-type-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProgramController()
export class ProgramController extends BaseController<ProgramService> {
	constructor(private readonly service: ProgramService) {
		super(service);
	}

	@SwaggerProgramCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateProgramDto) {
		return await super.create(dto);
	}

	@SwaggerProgramUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProgramDto) {
		return await super.update(id, dto);
	}

	@SwaggerProgramDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProgramGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProgramGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProgramGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterProgramDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerProgramByModality()
	@ApiModalityTypeHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async byModality(@ModalityTypeId() modalityTypeId: number) {
		return parseSuccessResponse(await this.service.getByModality(modalityTypeId));
	}
}
