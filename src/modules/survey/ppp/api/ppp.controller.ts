import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
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

@SwaggerPppController()
export class PppController {
	constructor(private readonly pppService: PppService) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerPppConfigCreate()
	async configCreate(@Body() dto: CreatePppConfigDto) {
		return parseSuccessResponse(await this.pppService.createConfig(dto), HttpStatus.CREATED);
	}

	@SwaggerPppConfigGetAll()
	async configGetAll() {
		return parseSuccessResponse(await this.pppService.getAllConfigs());
	}

	@SwaggerPppConfigGetByFilters()
	async configGetByFilters(@Body() dto: FilterPppConfigDto) {
		return parseSuccessResponse(await this.pppService.getAllConfigs(dto));
	}

	@SwaggerPppConfigGetById()
	async configGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.getConfigById(id));
	}

	@SwaggerPppConfigUpdate()
	async configUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePppConfigDto) {
		return parseSuccessResponse(await this.pppService.updateConfig(id, dto));
	}

	@SwaggerPppConfigDelete()
	async configDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.deleteConfig(id));
	}

	@SwaggerPppConfigReplicate()
	async configReplicate(@Body() dto: ReplicatePppConfigDto) {
		return parseSuccessResponse(await this.pppService.replicateConfig(dto));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerPppSurveyCreate()
	async surveyCreate(@Body() dto: CreatePppSurveyDto) {
		return parseSuccessResponse(await this.pppService.createSurvey(dto), HttpStatus.CREATED);
	}

	@SwaggerPppSurveyGetAll()
	async surveyGetAll() {
		return parseSuccessResponse(await this.pppService.getAllSurveys());
	}

	@SwaggerPppSurveyGetByFilters()
	async surveyGetByFilters(@Body() dto: FilterPppSurveyDto) {
		return parseSuccessResponse(await this.pppService.getSurveysByFilters(dto));
	}

	@SwaggerPppSurveyGetById()
	async surveyGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.getSurveyById(id));
	}

	@SwaggerPppSurveyUploadExcel()
	async surveyUploadExcel(@Body() dto: UploadPppExcelDto) {
		return parseSuccessResponse(await this.pppService.uploadExcel(dto));
	}

	@SwaggerPppSurveyDashboard()
	async surveyDashboard(@Body() dto: DashboardPppDto) {
		return parseSuccessResponse(await this.pppService.getDashboard(dto));
	}

	@SwaggerPppSurveyGenerateFindings()
	async surveyGenerateFindings(@Body() dto: GenerateFindingsPppDto) {
		return parseSuccessResponse(await this.pppService.generateFindings(dto));
	}
}
