import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerAccreditorController,
	SwaggerAccreditorCreate,
	SwaggerAccreditorUpdate,
	SwaggerAccreditorDelete,
	SwaggerAccreditorGetAll,
	SwaggerAccreditorGetById,
	SwaggerAccreditorGetByFilters,
} from './docs/accreditors.swagger';
import { AccreditorService } from './accreditors.service';
import {
	CreateAccreditorDto,
	UpdateAccreditorDto,
	FilterAccreditorDto,
} from '../model/accreditors.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACCREDITATION_MODULE = 'ACCREDITATION';

@SwaggerAccreditorController()
export class AccreditorController extends BaseController<AccreditorService> {
	constructor(private readonly service: AccreditorService) {
		super(service);
	}

	@SwaggerAccreditorCreate()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'POST' })
	async create(@Body() dto: CreateAccreditorDto) {
		return await super.create(dto);
	}

	@SwaggerAccreditorUpdate()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccreditorDto) {
		return await super.update(id, dto);
	}

	@SwaggerAccreditorDelete()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerAccreditorGetAll()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerAccreditorGetById()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerAccreditorGetByFilters()
	@RequirePermission({ module: ACCREDITATION_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterAccreditorDto) {
		return await super.getByFilters(dto);
	}
}
