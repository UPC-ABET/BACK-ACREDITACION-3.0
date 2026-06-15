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
	SwaggerPppSurveyTemplate,
	SwaggerPppSurveyDashboard,
	SwaggerPppSurveyGenerateFindings,
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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerPppController()
export class PppController {
	constructor(private readonly pppService: PppService) {}

	@SwaggerPppConfigCreate()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configCreate(@Body() dto: CreatePppConfigDto) {
		return parseSuccessResponse(await this.pppService.createConfig(dto), HttpStatus.CREATED);
	}

	@SwaggerPppConfigGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async configGetAll() {
		return parseSuccessResponse(await this.pppService.getAllConfigs());
	}

	@SwaggerPppConfigGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async configGetByFilters(@Body() dto: FilterPppConfigDto) {
		return parseSuccessResponse(await this.pppService.getAllConfigs(dto));
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
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyCreate(@Body() dto: CreatePppSurveyDto) {
		return parseSuccessResponse(await this.pppService.createSurvey(dto), HttpStatus.CREATED);
	}

	@SwaggerPppSurveyGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async surveyGetAll() {
		return parseSuccessResponse(await this.pppService.getAllSurveys());
	}

	@SwaggerPppSurveyGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyGetByFilters(@Body() dto: FilterPppSurveyDto) {
		return parseSuccessResponse(await this.pppService.getSurveysByFilters(dto));
	}

	@SwaggerPppSurveyGetById()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async surveyGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.getSurveyById(id));
	}

	@SwaggerPppSurveyUploadExcel()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyUploadExcel(@Body() dto: UploadPppExcelDto) {
		return parseSuccessResponse(await this.pppService.uploadExcel(dto));
	}

	@SwaggerPppSurveyTemplate()
	@ApiQuery({ name: 'programId', type: Number, example: 1, required: false })
	@ApiQuery({ name: 'academicPeriodId', type: Number, example: 1 })
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.GET })
	async surveyTemplate(
		@Query('academicPeriodId', ParseIntPipe) academicPeriodId: number,
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
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyDashboard(@Body() dto: DashboardPppDto) {
		return parseSuccessResponse(await this.pppService.getDashboard(dto));
	}

	@SwaggerPppSurveyGenerateFindings()
	@RequirePermission({ module: PERMISSION_MODULES.SURVEY, action: PERMISSION_ACTIONS.POST })
	async surveyGenerateFindings(@Body() dto: GenerateFindingsPppDto) {
		return parseSuccessResponse(await this.pppService.generateFindings(dto));
	}
}
