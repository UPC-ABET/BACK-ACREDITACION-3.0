import { Body } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import {
	SwaggerProcessedRvGradesController,
	SwaggerProcessedRvGradesGetByFilters,
	SwaggerProcessedRvGradesRebuild,
} from './docs/processed-rv-grades.swagger';
import { ProcessedRvGradesService } from './processed-rv-grades.service';
import { FilterProcessedRvGradeDto } from '../model/processed-rv-grades.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProcessedRvGradesController()
export class ProcessedRvGradesController {
	constructor(private readonly service: ProcessedRvGradesService) {}

	@SwaggerProcessedRvGradesGetByFilters()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(
		@Body() dto: FilterProcessedRvGradeDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(await this.service.list(dto, academicPeriodId));
	}

	@SwaggerProcessedRvGradesRebuild()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async rebuild(@AcademicPeriodId() academicPeriodId: number) {
		return parseSuccessResponse(await this.service.rebuild(academicPeriodId));
	}
}
