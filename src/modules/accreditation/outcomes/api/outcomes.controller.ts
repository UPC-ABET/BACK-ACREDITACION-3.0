import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerOutcomeController,
	SwaggerOutcomeCreate,
	SwaggerOutcomeUpdate,
	SwaggerOutcomeDelete,
	SwaggerOutcomeGetAll,
	SwaggerOutcomeGetById,
	SwaggerOutcomeGetByFilters,
} from './docs/outcomes.swagger';
import { OutcomeService } from './outcomes.service';
import { CreateOutcomeDto, UpdateOutcomeDto, FilterOutcomeDto } from '../model/outcomes.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACCREDITATION_MODULE = 'ACCREDITATION';

@SwaggerOutcomeController()
export class OutcomeController extends BaseController<OutcomeService> {
	constructor(private readonly service: OutcomeService) {
		super(service);
	}

	@SwaggerOutcomeCreate()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'POST' })
	async create(@Body() dto: CreateOutcomeDto) {
		return await super.create(dto);
	}

	@SwaggerOutcomeUpdate()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOutcomeDto) {
		return await super.update(id, dto);
	}

	@SwaggerOutcomeDelete()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerOutcomeGetAll()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerOutcomeGetById()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.getById(id));
	}

	@SwaggerOutcomeGetByFilters()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterOutcomeDto) {
		return await super.getByFilters(dto);
	}
}
