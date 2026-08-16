import { Body, HttpStatus, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';
import { PppService } from './ppp.service';
import {
	SwaggerPppController,
	SwaggerPppConfigCreate,
	SwaggerPppConfigGetAll,
	SwaggerPppConfigGetByFilters,
	SwaggerPppConfigGetById,
	SwaggerPppConfigUpdate,
	SwaggerPppConfigDelete,
	SwaggerPppConfigReplicate,
	SwaggerPppSurveyCreate,
	SwaggerPppSurveyGetAll,
	SwaggerPppSurveyGetByFilters,
	SwaggerPppSurveyGetById,
	SwaggerPppSurveyUploadExcel,
	SwaggerPppSurveyUploadStatus,
	SwaggerPppSurveyTemplate,
	SwaggerPppSurveyDashboard,
	SwaggerPppSurveyGenerateFindings,
	SwaggerPppReportPerception,
} from './docs/ppp.swagger';
import {
	CreatePppConfigDto,
	UpdatePppConfigDto,
	FilterPppConfigDto,
	ReplicatePppConfigDto,
	CreatePppSurveyDto,
	FilterPppSurveyDto,
	UploadPppExcelDto,
	DashboardPppDto,
	GenerateFindingsPppDto,
} from '../model/ppp.dtos';
import { PerceptionReportDto } from 'src/modules/survey/shared/model/perception-report.dto';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';

@SwaggerPppController()
export class PppController {
	constructor(private readonly pppService: PppService) {}

	@SwaggerPppConfigCreate()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configCreate(
		@Body() dto: CreatePppConfigDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return parseSuccessResponse(
			await this.pppService.createConfig(dto, academicPeriodId),
			HttpStatus.CREATED,
		);
	}

	@SwaggerPppConfigGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configGetAll() {
		return parseSuccessResponse(await this.pppService.getAllConfigs());
	}

	@SwaggerPppConfigGetByFilters()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configGetByFilters(
		@Body() dto: FilterPppConfigDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return parseSuccessResponse(await this.pppService.getAllConfigs({ ...dto, academicPeriodId }));
	}

	@SwaggerPppConfigGetById()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.getConfigById(id));
	}

	@SwaggerPppConfigUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.PUT })
	async configUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePppConfigDto) {
		return parseSuccessResponse(await this.pppService.updateConfig(id, dto));
	}

	@SwaggerPppConfigDelete()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.DELETE })
	async configDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.deleteConfig(id));
	}

	@SwaggerPppConfigReplicate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configReplicate(@Body() dto: ReplicatePppConfigDto) {
		return parseSuccessResponse(await this.pppService.replicateConfig(dto));
	}

	@SwaggerPppSurveyCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyCreate(
		@Body() dto: CreatePppSurveyDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(
			await this.pppService.createSurvey(dto, academicPeriodId),
			HttpStatus.CREATED,
		);
	}

	@SwaggerPppSurveyGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async surveyGetAll() {
		return parseSuccessResponse(await this.pppService.getAllSurveys());
	}

	@SwaggerPppSurveyGetByFilters()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyGetByFilters(
		@Body() dto: FilterPppSurveyDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return parseSuccessResponse(
			await this.pppService.getSurveysByFilters({ ...dto, academicPeriodId }),
		);
	}

	@SwaggerPppSurveyGetById()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async surveyGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.getSurveyById(id));
	}

	@SwaggerPppSurveyUploadExcel()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyUploadExcel(
		@Body() dto: UploadPppExcelDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(await this.pppService.startUploadExcel(dto, academicPeriodId));
	}

	@SwaggerPppSurveyUploadStatus()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async surveyUploadStatus(@Param('jobId') jobId: string) {
		return parseSuccessResponse(this.pppService.getUploadStatus(jobId));
	}

	@SwaggerPppSurveyTemplate()
	@ApiQuery({ name: 'programId', type: Number, example: 1, required: false })
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async surveyTemplate(
		@AcademicPeriodId() academicPeriodId: number,
		@Res() res: Response,
		@Query('programId') programIdRaw?: string,
	) {
		const programId =
			programIdRaw !== undefined && programIdRaw !== '' ? Number(programIdRaw) : undefined;
		const { buffer, fileName } = await this.pppService.generateTemplate(
			academicPeriodId,
			programId,
		);
		const encoded = encodeURIComponent(fileName);
		res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`,
		);
		res.setHeader('Content-Length', buffer.length.toString());
		res.end(buffer);
	}

	@SwaggerPppSurveyDashboard()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyDashboard(
		@Body() dto: DashboardPppDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return parseSuccessResponse(await this.pppService.getDashboard({ ...dto, academicPeriodId }));
	}

	@SwaggerPppSurveyGenerateFindings()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyGenerateFindings(
		@Body() dto: GenerateFindingsPppDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(await this.pppService.generateFindings(dto, academicPeriodId));
	}

	@SwaggerPppReportPerception()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async reportPerception(
		@Body() dto: PerceptionReportDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(
			await this.pppService.generatePerceptionReport(dto, academicPeriodId),
		);
	}
}
