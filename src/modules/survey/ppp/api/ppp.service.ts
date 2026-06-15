import { Injectable } from '@nestjs/common';
import { PppConfigService } from './ppp-config.service';
import { PppSurveyService } from './ppp-survey.service';
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

@Injectable()
export class PppService {
	constructor(
		private readonly configService: PppConfigService,
		private readonly surveyService: PppSurveyService,
	) {}

	createConfig(dto: CreatePppConfigDto) {
		return this.configService.create(dto);
	}

	getAllConfigs(filters?: FilterPppConfigDto) {
		return this.configService.getAll(filters);
	}

	getConfigById(id: number) {
		return this.configService.getById(id);
	}

	updateConfig(id: number, dto: UpdatePppConfigDto) {
		return this.configService.update(id, dto);
	}

	deleteConfig(id: number) {
		return this.configService.delete(id);
	}

	replicateConfig(dto: ReplicatePppConfigDto) {
		return this.configService.replicate(dto);
	}

	createSurvey(dto: CreatePppSurveyDto) {
		return this.surveyService.create(dto);
	}

	getAllSurveys() {
		return this.surveyService.getAll();
	}

	getSurveysByFilters(dto: FilterPppSurveyDto) {
		return this.surveyService.getByFilters(dto);
	}

	getSurveyById(id: number) {
		return this.surveyService.getById(id);
	}

	uploadExcel(dto: UploadPppExcelDto) {
		return this.surveyService.uploadExcel(dto);
	}

	generateTemplate(academicPeriodId: number, programId?: number) {
		return this.surveyService.generateTemplate(academicPeriodId, programId);
	}

	getDashboard(dto: DashboardPppDto) {
		return this.surveyService.getDashboard(dto);
	}

	generateFindings(dto: GenerateFindingsPppDto) {
		return this.surveyService.generateFindings(dto);
	}
}
