import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerOutcomeConversionController,
	SwaggerOutcomeConversionCreate,
	SwaggerOutcomeConversionUpdate,
	SwaggerOutcomeConversionDelete,
	SwaggerOutcomeConversionGetById,
	SwaggerOutcomeConversionGetByFilters,
	SwaggerOutcomeConversionCoverage,
} from './docs/outcome-conversions.swagger';
import { OutcomeConversionsService } from './outcome-conversions.service';
import {
	CreateOutcomeConversionDto,
	UpdateOutcomeConversionDto,
	FilterOutcomeConversionDto,
} from '../model/outcome-conversions.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerOutcomeConversionController()
export class OutcomeConversionsController extends BaseController<OutcomeConversionsService> {
	constructor(private readonly service: OutcomeConversionsService) {
		super(service);
	}

	@SwaggerOutcomeConversionCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateOutcomeConversionDto) {
		return parseSuccessResponse(await this.service.createConversion(dto), HttpStatus.CREATED);
	}

	@SwaggerOutcomeConversionUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOutcomeConversionDto) {
		return parseSuccessResponse(await this.service.updateConversion(id, dto));
	}

	@SwaggerOutcomeConversionDelete()
	@RequirePermission({
		module: PERMISSION_MODULES.ACCREDITATION,
		action: PERMISSION_ACTIONS.DELETE,
	})
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerOutcomeConversionGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.getById(id));
	}

	@SwaggerOutcomeConversionGetByFilters()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.POST })
	async listByFilters(
		@Body() dto: FilterOutcomeConversionDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(await this.service.getByFiltersDetailed(dto, academicPeriodId));
	}

	@SwaggerOutcomeConversionCoverage()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACCREDITATION, action: PERMISSION_ACTIONS.GET })
	async coverage(@AcademicPeriodId() academicPeriodId: number) {
		return parseSuccessResponse(await this.service.getCoverage(academicPeriodId));
	}
}
