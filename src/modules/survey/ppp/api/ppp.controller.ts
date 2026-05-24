import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { PppConfigService } from './ppp-config.service';
import { PppSurveyService } from './ppp-survey.service';
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
	constructor(
		private readonly configService: PppConfigService,
		private readonly surveyService: PppSurveyService,
	) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerPppConfigCreate()
	async configCreate(@Body() dto: CreatePppConfigDto) {
		return parseSuccessResponse(await this.configService.create(dto));
	}

	@SwaggerPppConfigGetAll()
	async configGetAll() {
		return parseSuccessResponse(await this.configService.getAll());
	}

	@SwaggerPppConfigGetByFilters()
	async configGetByFilters(@Body() dto: FilterPppConfigDto) {
		return parseSuccessResponse(await this.configService.getAll(dto));
	}

	@SwaggerPppConfigGetById()
	async configGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.configService.getById(id));
	}

	@SwaggerPppConfigUpdate()
	async configUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePppConfigDto) {
		return parseSuccessResponse(await this.configService.update(id, dto));
	}

	@SwaggerPppConfigDelete()
	async configDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.configService.delete(id));
	}

	@SwaggerPppConfigReplicate()
	async configReplicate(@Body() dto: ReplicatePppConfigDto) {
		return parseSuccessResponse(await this.configService.replicate(dto));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerPppSurveyCreate()
	async surveyCreate(@Body() dto: CreatePppSurveyDto) {
		return parseSuccessResponse(await this.surveyService.create(dto));
	}

	@SwaggerPppSurveyGetAll()
	async surveyGetAll() {
		return parseSuccessResponse(await this.surveyService.getAll());
	}

	@SwaggerPppSurveyGetByFilters()
	async surveyGetByFilters(@Body() dto: FilterPppSurveyDto) {
		return parseSuccessResponse(await this.surveyService.getByFilters(dto));
	}

	@SwaggerPppSurveyGetById()
	async surveyGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.surveyService.getById(id));
	}

	@SwaggerPppSurveyUploadExcel()
	async surveyUploadExcel(@Body() dto: UploadPppExcelDto) {
		return parseSuccessResponse(await this.surveyService.uploadExcel(dto));
	}

	@SwaggerPppSurveyDashboard()
	async surveyDashboard(@Body() dto: DashboardPppDto) {
		return parseSuccessResponse(await this.surveyService.getDashboard(dto));
	}

	@SwaggerPppSurveyGenerateFindings()
	async surveyGenerateFindings(@Body() dto: GenerateFindingsPppDto) {
		return parseSuccessResponse(await this.surveyService.generateFindings(dto));
	}
}
