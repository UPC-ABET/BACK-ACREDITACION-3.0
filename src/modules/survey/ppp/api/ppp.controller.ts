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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const SURVEY_MODULE = 'SURVEY';

@SwaggerPppController()
export class PppController {
	constructor(private readonly pppService: PppService) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

	@SwaggerPppConfigCreate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async configCreate(@Body() dto: CreatePppConfigDto) {
		return parseSuccessResponse(await this.pppService.createConfig(dto), HttpStatus.CREATED);
	}

	@SwaggerPppConfigGetAll()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async configGetAll() {
		return parseSuccessResponse(await this.pppService.getAllConfigs());
	}

	@SwaggerPppConfigGetByFilters()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async configGetByFilters(@Body() dto: FilterPppConfigDto) {
		return parseSuccessResponse(await this.pppService.getAllConfigs(dto));
	}

	@SwaggerPppConfigGetById()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async configGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.getConfigById(id));
	}

	@SwaggerPppConfigUpdate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'PUT' })
	async configUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePppConfigDto) {
		return parseSuccessResponse(await this.pppService.updateConfig(id, dto));
	}

	@SwaggerPppConfigDelete()
	@RequirePermission({ module: SURVEY_MODULE, action: 'DELETE' })
	async configDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.deleteConfig(id));
	}

	@SwaggerPppConfigReplicate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async configReplicate(@Body() dto: ReplicatePppConfigDto) {
		return parseSuccessResponse(await this.pppService.replicateConfig(dto));
	}

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

	@SwaggerPppSurveyCreate()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async surveyCreate(@Body() dto: CreatePppSurveyDto) {
		return parseSuccessResponse(await this.pppService.createSurvey(dto), HttpStatus.CREATED);
	}

	@SwaggerPppSurveyGetAll()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async surveyGetAll() {
		return parseSuccessResponse(await this.pppService.getAllSurveys());
	}

	@SwaggerPppSurveyGetByFilters()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async surveyGetByFilters(@Body() dto: FilterPppSurveyDto) {
		return parseSuccessResponse(await this.pppService.getSurveysByFilters(dto));
	}

	@SwaggerPppSurveyGetById()
	@RequirePermission({ module: SURVEY_MODULE, action: 'GET' })
	async surveyGetById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.pppService.getSurveyById(id));
	}

	@SwaggerPppSurveyUploadExcel()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async surveyUploadExcel(@Body() dto: UploadPppExcelDto) {
		return parseSuccessResponse(await this.pppService.uploadExcel(dto));
	}

	@SwaggerPppSurveyDashboard()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async surveyDashboard(@Body() dto: DashboardPppDto) {
		return parseSuccessResponse(await this.pppService.getDashboard(dto));
	}

	@SwaggerPppSurveyGenerateFindings()
	@RequirePermission({ module: SURVEY_MODULE, action: 'POST' })
	async surveyGenerateFindings(@Body() dto: GenerateFindingsPppDto) {
		return parseSuccessResponse(await this.pppService.generateFindings(dto));
	}
}
