import { Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import {
	SwaggerSemaphoreReportsController,
	SwaggerSemaphoreRc,
	SwaggerSemaphoreRcPdf,
	SwaggerSemaphoreRcExcel,
	SwaggerSemaphoreRv,
	SwaggerSemaphoreRvPdf,
	SwaggerSemaphoreRvExcel,
} from './docs/semaphore-reports.swagger';
import { SemaphoreReportsService } from './semaphore-reports.service';
import { SemaphoreFilterDto } from '../model/semaphore-reports.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';

@SwaggerSemaphoreReportsController()
export class SemaphoreReportsController {
	constructor(private readonly service: SemaphoreReportsService) {}

	@SwaggerSemaphoreRc()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async rc(@Body() dto: SemaphoreFilterDto, @AcademicPeriodId() academicPeriodId: number) {
		const result = await this.service.getRcData(dto, academicPeriodId);
		return parseSuccessResponse(result);
	}

	@SwaggerSemaphoreRcPdf()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async rcPdf(
		@Body() dto: SemaphoreFilterDto,
		@AcademicPeriodId() academicPeriodId: number,
		@Res({ passthrough: false }) res: Response,
	) {
		const { buffer, filename, contentType } = await this.service.generateRcPdf(
			dto,
			academicPeriodId,
		);
		writeBinary(res, buffer, filename, contentType);
	}

	@SwaggerSemaphoreRcExcel()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async rcExcel(
		@Body() dto: SemaphoreFilterDto,
		@AcademicPeriodId() academicPeriodId: number,
		@Res({ passthrough: false }) res: Response,
	) {
		const { buffer, filename, contentType } = await this.service.generateRcExcel(
			dto,
			academicPeriodId,
		);
		writeBinary(res, buffer, filename, contentType);
	}

	@SwaggerSemaphoreRv()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async rv(@Body() dto: SemaphoreFilterDto, @AcademicPeriodId() academicPeriodId: number) {
		const result = await this.service.getRvData(dto, academicPeriodId);
		return parseSuccessResponse(result);
	}

	@SwaggerSemaphoreRvPdf()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async rvPdf(
		@Body() dto: SemaphoreFilterDto,
		@AcademicPeriodId() academicPeriodId: number,
		@Res({ passthrough: false }) res: Response,
	) {
		const { buffer, filename, contentType } = await this.service.generateRvPdf(
			dto,
			academicPeriodId,
		);
		writeBinary(res, buffer, filename, contentType);
	}

	@SwaggerSemaphoreRvExcel()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async rvExcel(
		@Body() dto: SemaphoreFilterDto,
		@AcademicPeriodId() academicPeriodId: number,
		@Res({ passthrough: false }) res: Response,
	) {
		const { buffer, filename, contentType } = await this.service.generateRvExcel(
			dto,
			academicPeriodId,
		);
		writeBinary(res, buffer, filename, contentType);
	}
}

function writeBinary(res: Response, body: Buffer, filename: string, contentType: string) {
	const encoded = encodeURIComponent(filename);
	res.setHeader('Content-Type', contentType);
	res.setHeader(
		'Content-Disposition',
		`attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
	);
	res.setHeader('Content-Length', body.length.toString());
	res.end(body);
}
