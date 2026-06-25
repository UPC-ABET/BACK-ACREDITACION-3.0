import { Injectable } from '@nestjs/common';
import { GraConfigService } from './gra-config.service';
import { GraNotificationService } from './gra-notification.service';
import { PerceptionReportService } from 'src/modules/survey/shared/perception-report.service';
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
	SendGraEmailDto,
	GetSurveyByTokenDto,
	CompleteGraSurveyDto,
	DashboardGraDto,
} from '../model/gra.dtos';

@Injectable()
export class GraService {
	constructor(
		private readonly configService: GraConfigService,
		private readonly notifService: GraNotificationService,
		private readonly perceptionReport: PerceptionReportService,
	) {}

	generatePerceptionReport(dto: PerceptionReportDto, academicPeriodId: number) {
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

	deleteNotification(id: number) {
		return this.notifService.deleteNotification(id);
	}

	sendEmails(dto: SendGraEmailDto, academicPeriodId: number) {
		return this.notifService.sendEmails(dto, academicPeriodId);
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
