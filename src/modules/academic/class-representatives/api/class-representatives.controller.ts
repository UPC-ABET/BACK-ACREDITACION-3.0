import { Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { ClassRepresentativesService } from './class-representatives.service';
import {
	AssignRepresentativeDto,
	ClassRepresentativeMaintenanceQueryDto,
} from '../model/class-representatives.dtos';
import {
	SwaggerClassRepresentativeController,
	SwaggerClassRepresentativeGetAll,
	SwaggerClassRepresentativeAssign,
	SwaggerClassRepresentativeRemove,
	SwaggerClassRepresentativeMaintenance,
} from './docs/class-representatives.swagger';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';

@SwaggerClassRepresentativeController()
export class ClassRepresentativesController extends BaseController<ClassRepresentativesService> {
	constructor(private readonly service: ClassRepresentativesService) {
		super(service);
	}

	@SwaggerClassRepresentativeGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return parseSuccessResponse(await this.service.getAll());
	}

	@SwaggerClassRepresentativeAssign()
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async assign(@Body() dto: AssignRepresentativeDto) {
		return parseSuccessResponse(await this.service.assignRepresentative(dto));
	}

	@SwaggerClassRepresentativeRemove()
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async remove(@Body() dto: AssignRepresentativeDto) {
		// Cambiado a @Body para recibir los códigos del payload
		return parseSuccessResponse(await this.service.removeRepresentative(dto));
	}

	@SwaggerClassRepresentativeMaintenance()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async maintenance(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: ClassRepresentativeMaintenanceQueryDto,
	) {
		return parseSuccessResponse(await this.service.getMaintenanceList(academicPeriodId, query));
	}
}
