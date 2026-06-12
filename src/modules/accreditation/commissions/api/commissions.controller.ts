import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCommissionController,
	SwaggerCommissionCreate,
	SwaggerCommissionUpdate,
	SwaggerCommissionDelete,
	SwaggerCommissionGetAll,
	SwaggerCommissionGetById,
	SwaggerCommissionGetByFilters,
} from './docs/commissions.swagger';
import { CommissionService } from './commissions.service';
import {
	CreateCommissionDto,
	UpdateCommissionDto,
	FilterCommissionDto,
} from '../model/commissions.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerCommissionController()
export class CommissionController extends BaseController<CommissionService> {
	constructor(private readonly service: CommissionService) {
		super(service);
	}

	@SwaggerCommissionCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateCommissionDto) {
		return await super.create(dto);
	}

	@SwaggerCommissionUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCommissionDto) {
		return await super.update(id, dto);
	}

	@SwaggerCommissionDelete()
	@RequirePermission({
		module: PERMISSION_MODULES.ACCREDITATION,
		action: PERMISSION_ACTIONS.DELETE,
	})
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCommissionGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCommissionGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCommissionGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterCommissionDto) {
		return await super.getByFilters(dto);
	}
}
