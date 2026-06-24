import { Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
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
export class ClassRepresentativesController {
	constructor(private readonly service: ClassRepresentativesService) {}

	@SwaggerClassRepresentativeGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return parseSuccessResponse(await this.service.getAll());
	}

	@SwaggerClassRepresentativeAssign()
	@ApiAcademicPeriodHeader()
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async assign(@AcademicPeriodId() academicPeriodId: number, @Body() dto: AssignRepresentativeDto) {
		return parseSuccessResponse(await this.service.assignRepresentative(dto, academicPeriodId));
	}

	@SwaggerClassRepresentativeRemove()
	@ApiAcademicPeriodHeader()
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async remove(@AcademicPeriodId() academicPeriodId: number, @Body() dto: AssignRepresentativeDto) {
		return parseSuccessResponse(await this.service.removeRepresentative(dto, academicPeriodId));
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
