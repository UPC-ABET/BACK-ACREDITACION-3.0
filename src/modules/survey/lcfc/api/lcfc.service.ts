import { Injectable } from '@nestjs/common';
import type { ReportLanguage } from 'src/libs/reporting/report.types';
import { LcfcConfigService } from './lcfc-config.service';
import { LcfcNotificationService } from './lcfc-notification.service';
import { LcfcReportService } from './lcfc-report.service';
import { PerceptionReportService } from 'src/modules/survey/shared/perception-report.service';
import type { PerceptionReportDto } from 'src/modules/survey/shared/model/perception-report.dto';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import {
	GenerateLcfcConfigDto,
	CloneLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
	UpdateLcfcConfigDto,
	SetLcfcDeadlineDto,
	SendLcfcNotificationDto,
	GetLcfcSurveyByTokenDto,
	CompleteLcfcSurveyDto,
	DashboardLcfcDto,
} from '../model/lcfc.dtos';

@Injectable()
export class LcfcService {
	constructor(
		private readonly configService: LcfcConfigService,
		private readonly notifService: LcfcNotificationService,
		private readonly reportService: LcfcReportService,
		private readonly perceptionReport: PerceptionReportService,
	) {}

	generateReportPdf(academicPeriodId: number, programId: number | undefined, lang: ReportLanguage) {
		return this.reportService.generateResultsPdf(academicPeriodId, programId, lang);
	}

	generatePerceptionReport(dto: PerceptionReportDto, academicPeriodId: number) {
		return this.perceptionReport.generate({
			surveyTypeCode: TYPE_CODES.SURVEY_TYPE.LCFC,
			fileLabel: 'LCFC',
			reportName: { es: 'Informe de Resultados LCFC', en: 'LCFC Results Report' },
			academicPeriodId,
			programId: dto.programId,
			commissionId: dto.commissionId,
			campusId: dto.campusId,
			surveyNumbers: dto.surveyNumbers,
			modalityLabel: dto.modalityLabel,
			lang: dto.lang ?? 'es',
		});
	}

	generateConfigs(dto: GenerateLcfcConfigDto, schoolId: number, academicPeriodId: number) {
		return this.configService.generateConfigs(dto, schoolId, academicPeriodId);
	}

	getAllConfigs(filters?: FilterLcfcConfigDto & { academicPeriodId?: number | null }) {
		return this.configService.getAll(filters);
	}

	getConfigById(id: number) {
		return this.configService.getConfigById(id);
	}

	updateConfig(id: number, dto: UpdateLcfcConfigDto) {
		return this.configService.updateConfig(id, dto);
	}

	updateConfigStatus(dto: UpdateLcfcConfigStatusDto) {
		return this.configService.updateStatus(dto);
	}

	cloneConfig(dto: CloneLcfcConfigDto) {
		return this.configService.cloneConfig(dto);
	}

	deleteConfig(id: number) {
		return this.configService.deleteConfig(id);
	}

	getAvailableSections(programId: number | null | undefined, academicPeriodId: number) {
		return this.configService.getAvailableSections(programId, academicPeriodId);
	}

	getSectionOutcomes(courseSectionId: number, programId: number) {
		return this.configService.getSectionOutcomes(courseSectionId, programId);
	}

	getSectionCommissions(courseSectionId: number, programId?: number | null) {
		return this.configService.getSectionCommissions(courseSectionId, programId);
	}

	setDeadline(dto: SetLcfcDeadlineDto, academicPeriodId: number) {
		return this.configService.setDeadline(
			dto.programId ?? null,
			academicPeriodId,
			dto.maxRegisterDate,
		);
	}

	getDeadline(programId: number | null | undefined, academicPeriodId: number) {
		return this.configService.getDeadline(programId, academicPeriodId);
	}

	sendNotifications(dto: SendLcfcNotificationDto, academicPeriodId: number) {
		return this.notifService.sendNotifications(dto, academicPeriodId);
	}

	validateToken(token: string) {
		return this.notifService.validateToken(token);
	}

	getStudentSurveys(token: string) {
		return this.notifService.getStudentSurveys(token);
	}

	getSurveyByToken(dto: GetLcfcSurveyByTokenDto) {
		return this.notifService.getSurveyByToken(dto);
	}

	completeSurvey(dto: CompleteLcfcSurveyDto) {
		return this.notifService.completeSurvey(dto);
	}

	getDashboard(dto: DashboardLcfcDto & { academicPeriodId?: number | null }) {
		return this.notifService.getDashboard(dto);
	}

	exportSurveys(academicPeriodId: number, programId?: number) {
		return this.notifService.exportSurveys(academicPeriodId, programId);
	}
}
