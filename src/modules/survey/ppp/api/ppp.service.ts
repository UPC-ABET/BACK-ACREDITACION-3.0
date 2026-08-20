import { Injectable } from '@nestjs/common';
import { PppConfigService } from './ppp-config.service';
import { PppSurveyService } from './ppp-survey.service';
import { PerceptionReportService } from 'src/modules/survey/shared/perception-report.service';
import type { PerceptionReportDto } from 'src/modules/survey/shared/model/perception-report.dto';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
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
		private readonly perceptionReport: PerceptionReportService,
	) {}

	generatePerceptionReport(dto: PerceptionReportDto, academicPeriodId: number) {
		// `dto.programId` set always implies `dto.commissionId` is also set — PerceptionReportDto
		// rejects a career filter without a commission before this method ever runs.
		return this.perceptionReport.generate({
			surveyTypeCode: TYPE_CODES.SURVEY_TYPE.PPP,
			fileLabel: 'PPP',
			reportName: {
				es: 'Informe de Prácticas Pre Profesionales',
				en: 'Pre-Professional Internship Report',
			},
			academicPeriodId,
			programId: dto.programId,
			commissionId: dto.commissionId,
			campusId: dto.campusId,
			surveyNumbers: dto.surveyNumbers,
			modalityLabel: dto.modalityLabel,
			lang: dto.lang ?? 'es',
		});
	}

	createConfig(dto: CreatePppConfigDto, academicPeriodId?: number | null) {
		return this.configService.create(dto, academicPeriodId);
	}

	getAllConfigs(filters?: FilterPppConfigDto & { academicPeriodId?: number | null }) {
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

	createSurvey(dto: CreatePppSurveyDto, academicPeriodId: number) {
		return this.surveyService.create(dto, academicPeriodId);
	}

	getAllSurveys() {
		return this.surveyService.getAll();
	}

	getSurveysByFilters(dto: FilterPppSurveyDto & { academicPeriodId?: number | null }) {
		return this.surveyService.getByFilters(dto);
	}

	getSurveyById(id: number) {
		return this.surveyService.getById(id);
	}

	startUploadExcel(dto: UploadPppExcelDto, academicPeriodId: number, userId: number) {
		return this.surveyService.startUploadExcel(dto, academicPeriodId, userId);
	}

	getUploadStatus(jobId: string, userId: number) {
		return this.surveyService.getUploadStatus(jobId, userId);
	}

	getUploadErrorFile(jobId: string, userId: number) {
		return this.surveyService.getUploadErrorFile(jobId, userId);
	}

	generateTemplate(academicPeriodId: number, programId?: number) {
		return this.surveyService.generateTemplate(academicPeriodId, programId);
	}

	getDashboard(dto: DashboardPppDto & { academicPeriodId?: number | null }) {
		return this.surveyService.getDashboard(dto);
	}

	generateFindings(dto: GenerateFindingsPppDto, academicPeriodId: number) {
		return this.surveyService.generateFindings(dto, academicPeriodId);
	}
}
