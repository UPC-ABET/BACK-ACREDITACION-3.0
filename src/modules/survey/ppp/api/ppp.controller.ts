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
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerPppController()
export class PppController {
	constructor(private readonly pppService: PppService) {}

	// ── CONFIG ENDPOINTS ──────────────────────────────────────────────

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

	// ── SURVEY ENDPOINTS ──────────────────────────────────────────────

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
