import { Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProgramCommissionController,
	SwaggerProgramCommissionGetAll,
	SwaggerProgramCommissionGetById,
	SwaggerProgramCommissionGetByFilters,
	SwaggerProgramCommissionCommissionOptions,
	SwaggerProgramCommissionProgramOptions,
	SwaggerProgramCommissionGetDetailedByFilters,
} from './docs/program-commissions.swagger';
import { ProgramCommissionService } from './program-commissions.service';
import {
	FilterProgramCommissionDto,
	FilterProgramCommissionDetailedDto,
	CommissionOptionsQueryDto,
	ProgramOptionsQueryDto,
} from '../model/program-commissions.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProgramCommissionController()
export class ProgramCommissionController extends BaseController<ProgramCommissionService> {
	constructor(private readonly service: ProgramCommissionService) {
		super(service);
	}

	@SwaggerProgramCommissionGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProgramCommissionGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProgramCommissionGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterProgramCommissionDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerProgramCommissionCommissionOptions()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async commissionOptions(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: CommissionOptionsQueryDto,
	) {
		return parseSuccessResponse(
			await this.service.getCommissionOptions(academicPeriodId, query.accreditorId),
		);
	}

	@SwaggerProgramCommissionProgramOptions()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async programOptions(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: ProgramOptionsQueryDto,
	) {
		return parseSuccessResponse(
			await this.service.getProgramOptions(academicPeriodId, query.commissionId),
		);
	}

	@SwaggerProgramCommissionGetDetailedByFilters()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async getDetailedByFilters(
		@AcademicPeriodId() academicPeriodId: number,
		@Body() dto: FilterProgramCommissionDetailedDto,
	) {
		return parseSuccessResponse(await this.service.getDetailedByFilters(academicPeriodId, dto));
	}
}
