import { Injectable } from '@nestjs/common';
import type { ReportLanguage } from 'src/libs/reporting/report.types';
import { LcfcConfigService } from './lcfc-config.service';
import { LcfcNotificationService } from './lcfc-notification.service';
import { LcfcReportService } from './lcfc-report.service';
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
	) {}

	generateReportPdf(academicPeriodId: number, programId: number | undefined, lang: ReportLanguage) {
		return this.reportService.generateResultsPdf(academicPeriodId, programId, lang);
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
