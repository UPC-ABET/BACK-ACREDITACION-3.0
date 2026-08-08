import { Injectable } from '@nestjs/common';
import { GraConfigService } from './gra-config.service';
import { GraNotificationService } from './gra-notification.service';
import { GraReportService } from './gra-report.service';
import {
	PerceptionReportService,
	type PerceptionReportResult,
} from 'src/modules/survey/shared/perception-report.service';
import type { PerceptionReportDto } from 'src/modules/survey/shared/model/perception-report.dto';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import {
	CreateGraConfigDto,
	UpdateGraConfigDto,
	FilterGraConfigDto,
	ReplicateGraConfigDto,
	ListGraSurveyOutcomesDto,
	SaveGraNotificationDto,
	BulkUploadGraNotificationDto,
	UpdateGraEmailTemplateDto,
	ListStudentsGraDto,
	ExportGraStudentsQueryDto,
	SendGraEmailDto,
	ResendGraNotificationDto,
	GetSurveyByTokenDto,
	CompleteGraSurveyDto,
	DashboardGraDto,
	SearchGraStudentsDto,
} from '../model/gra.dtos';

@Injectable()
export class GraService {
	constructor(
		private readonly configService: GraConfigService,
		private readonly notifService: GraNotificationService,
		private readonly reportService: GraReportService,
		private readonly perceptionReport: PerceptionReportService,
	) {}

	async generatePerceptionReport(
		dto: PerceptionReportDto,
		academicPeriodId: number,
	): Promise<PerceptionReportResult> {
		// No program/commission/campus filter → simple per-career completion overview
		// instead of the perception-by-outcome PDFs (same behavior as LCFC).
		if (!dto.programId && !dto.commissionId && !dto.campusId) {
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
			surveyTypeCode: TYPE_CODES.SURVEY_TYPE.GRA,
			fileLabel: 'GRA',
			reportName: {
				es: 'Informe de Encuesta de Graduandos',
				en: 'Graduating Students Survey Report',
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

	createConfig(dto: CreateGraConfigDto, academicPeriodId: number) {
		return this.configService.create(dto, academicPeriodId);
	}

	getAllConfigs(filters?: FilterGraConfigDto & { academicPeriodId?: number | null }) {
		return this.configService.getAll(filters);
	}

	getConfigById(id: number) {
		return this.configService.getById(id);
	}

	updateConfig(id: number, dto: UpdateGraConfigDto) {
		return this.configService.update(id, dto);
	}

	deleteConfig(id: number) {
		return this.configService.delete(id);
	}

	replicateConfig(dto: ReplicateGraConfigDto) {
		return this.configService.replicate(dto);
	}

	listOutcomesForSurvey(dto: ListGraSurveyOutcomesDto, academicPeriodId: number) {
		return this.configService.listOutcomesForSurvey(dto, academicPeriodId);
	}

	saveNotification(dto: SaveGraNotificationDto, academicPeriodId: number) {
		return this.notifService.saveNotification(dto, academicPeriodId);
	}

	generateNotificationTemplate() {
		return this.notifService.generateNotificationTemplate();
	}

	bulkUploadNotifications(dto: BulkUploadGraNotificationDto, academicPeriodId: number) {
		return this.notifService.bulkUploadNotifications(dto, academicPeriodId);
	}

	listStudents(dto: ListStudentsGraDto, academicPeriodId?: number | null) {
		return this.notifService.listStudents(dto, academicPeriodId);
	}

	exportStudents(filters: ExportGraStudentsQueryDto, academicPeriodId?: number | null) {
		return this.notifService.exportStudents(filters, academicPeriodId);
	}

	searchStudents(dto: SearchGraStudentsDto) {
		return this.notifService.searchStudents(dto);
	}

	deleteNotification(id: number) {
		return this.notifService.deleteNotification(id);
	}

	resendNotification(notificationId: number, dto: ResendGraNotificationDto) {
		return this.notifService.resendNotification(notificationId, dto);
	}

	getSendSummary(dto: SendGraEmailDto, academicPeriodId: number) {
		return this.notifService.getSendSummary(dto, academicPeriodId);
	}

	startSendEmails(dto: SendGraEmailDto, academicPeriodId: number) {
		return this.notifService.startSendEmails(dto, academicPeriodId);
	}

	getSendStatus(jobId: string) {
		return this.notifService.getSendStatus(jobId);
	}

	getEmailTemplateConfig() {
		return this.notifService.getEmailTemplateConfig();
	}

	updateEmailTemplateConfig(dto: UpdateGraEmailTemplateDto) {
		return this.notifService.updateEmailTemplateConfig(dto);
	}

	validateToken(token: string) {
		return this.notifService.validateToken(token);
	}

	getSurveyByToken(dto: GetSurveyByTokenDto) {
		return this.notifService.getSurveyByToken(dto);
	}

	completeSurvey(dto: CompleteGraSurveyDto) {
		return this.notifService.completeSurvey(dto);
	}

	getDashboard(dto: DashboardGraDto, academicPeriodId?: number | null) {
		return this.notifService.getDashboard(dto, academicPeriodId);
	}

	exportSurveys(academicPeriodId: number, programId?: number) {
		return this.notifService.exportSurveys(academicPeriodId, programId);
	}
}
