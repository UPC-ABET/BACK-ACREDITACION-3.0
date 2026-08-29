import { Injectable } from '@nestjs/common';
import type { ReportLanguage } from 'src/libs/reporting/report.types';
import { LcfcConfigService } from './lcfc-config.service';
import { LcfcNotificationService } from './lcfc-notification.service';
import { LcfcReportService } from './lcfc-report.service';
import { LcfcConversionService, type LcfcConversionResult } from './lcfc-conversion.service';
import {
	PerceptionReportService,
	type PerceptionReportResult,
} from 'src/modules/survey/shared/perception-report.service';
import type { PerceptionReportDto } from 'src/modules/survey/shared/model/perception-report.dto';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import {
	GenerateLcfcConfigDto,
	CloneLcfcConfigDto,
	FilterLcfcConfigDto,
	ListLcfcSectionsDto,
	UpdateLcfcConfigStatusDto,
	UpdateLcfcConfigDto,
	SetLcfcDeadlineDto,
	SendLcfcNotificationDto,
	GetLcfcSurveyByTokenDto,
	CompleteLcfcSurveyDto,
	DashboardLcfcDto,
	ListLcfcOutcomesDto,
	LcfcOutcomeReportDto,
} from '../model/lcfc.dtos';

@Injectable()
export class LcfcService {
	constructor(
		private readonly configService: LcfcConfigService,
		private readonly notifService: LcfcNotificationService,
		private readonly reportService: LcfcReportService,
		private readonly conversionService: LcfcConversionService,
		private readonly perceptionReport: PerceptionReportService,
	) {}

	rebuildConversions(academicPeriodId: number): Promise<LcfcConversionResult> {
		return this.conversionService.rebuildPeriod(academicPeriodId);
	}

	generateReportPdf(
		academicPeriodId: number,
		programId: number | undefined,
		lang: ReportLanguage,
		groupBy: 'course' | 'section' = 'section',
		courseId?: number,
		courseSectionId?: number,
		hideCourseBreakdown?: boolean,
	) {
		return this.reportService.generateResultsPdf(
			academicPeriodId,
			programId,
			lang,
			groupBy,
			courseId,
			courseSectionId,
			hideCourseBreakdown,
		);
	}

	async generatePerceptionReport(
		dto: PerceptionReportDto,
		academicPeriodId: number,
	): Promise<PerceptionReportResult> {
		// No program/commission/campus filter → simple per-program completion overview
		// instead of the perception-by-outcome PDFs.
		// Below this branch, `dto.programId` set always implies `dto.commissionId` is also
		// set — PerceptionReportDto rejects a career filter without a commission before this
		// method ever runs, so a "career only, split by every commission" request is no longer
		// reachable here (deliberate: commission is required as soon as a career is filtered).
		if (
			!dto.programId &&
			!dto.commissionId &&
			!dto.campusId &&
			!dto.courseId &&
			!dto.courseSectionId
		) {
			const { pdf, filename } = await this.reportService.generateProgramSummaryPdf(
				academicPeriodId,
				dto.lang ?? 'es',
			);
			return {
				reports: [{ campusId: null, campusName: '', filename, base64: pdf.toString('base64') }],
				zip: null,
			};
		}
		return this.perceptionReport.generate({
			surveyTypeCode: TYPE_CODES.SURVEY_TYPE.LCFC,
			fileLabel: 'LCFC',
			reportName: { es: 'Informe de Resultados LCFC', en: 'LCFC Results Report' },
			totalLabel: { es: 'Total de estudiantes', en: 'Total students' },
			chartTitle: { es: 'Percepción por Curso', en: 'Perception by Course' },
			showCourseFilters: true,
			academicPeriodId,
			programId: dto.programId,
			commissionId: dto.commissionId,
			campusId: dto.campusId,
			surveyNumbers: dto.surveyNumbers,
			modalityLabel: dto.modalityLabel,
			courseId: dto.courseId,
			courseSectionId: dto.courseSectionId,
			lang: dto.lang ?? 'es',
		});
	}

	listOutcomes(dto: ListLcfcOutcomesDto, academicPeriodId: number) {
		return this.perceptionReport.listOutcomes(dto.programId, dto.commissionId, academicPeriodId);
	}

	generateOutcomeReportPdf(
		dto: LcfcOutcomeReportDto,
		academicPeriodId: number,
	): Promise<PerceptionReportResult> {
		return this.perceptionReport.generateOutcomeReport({
			surveyTypeCode: TYPE_CODES.SURVEY_TYPE.LCFC,
			fileLabel: 'LCFC',
			academicPeriodId,
			programId: dto.programId,
			commissionId: dto.commissionId,
			outcomeId: dto.outcomeId,
			lang: dto.lang ?? 'es',
		});
	}

	generateConfigs(dto: GenerateLcfcConfigDto, schoolId: number, academicPeriodId: number) {
		return this.configService.generateConfigs(dto, schoolId, academicPeriodId);
	}

	getAllConfigs(filters?: FilterLcfcConfigDto & { academicPeriodId?: number | null }) {
		return this.configService.getAll(filters);
	}

	listSectionSummaries(filters?: ListLcfcSectionsDto & { academicPeriodId?: number | null }) {
		return this.configService.listSectionSummaries(filters);
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

	getSendSummary(dto: SendLcfcNotificationDto, academicPeriodId: number) {
		return this.notifService.getSendSummary(dto, academicPeriodId);
	}

	startSendNotifications(dto: SendLcfcNotificationDto, academicPeriodId: number, userId: number) {
		return this.notifService.startSendNotifications(dto, academicPeriodId, userId);
	}

	getSendNotificationStatus(jobId: string, userId: number) {
		return this.notifService.getSendNotificationStatus(jobId, userId);
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
