import { Injectable } from '@nestjs/common';
import { GraConfigService } from './gra-config.service';
import { GraNotificationService } from './gra-notification.service';
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
	) {}

	createConfig(dto: CreateGraConfigDto) {
		return this.configService.create(dto);
	}

	getAllConfigs(filters?: FilterGraConfigDto) {
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

	listOutcomesForSurvey(dto: ListGraSurveyOutcomesDto) {
		return this.configService.listOutcomesForSurvey(dto);
	}

	saveNotification(dto: SaveGraNotificationDto) {
		return this.notifService.saveNotification(dto);
	}

	generateNotificationTemplate() {
		return this.notifService.generateNotificationTemplate();
	}

	bulkUploadNotifications(dto: BulkUploadGraNotificationDto) {
		return this.notifService.bulkUploadNotifications(dto);
	}

	listStudents(dto: ListStudentsGraDto) {
		return this.notifService.listStudents(dto);
	}

	deleteNotification(id: number) {
		return this.notifService.deleteNotification(id);
	}

	sendEmails(dto: SendGraEmailDto) {
		return this.notifService.sendEmails(dto);
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

	getDashboard(dto: DashboardGraDto) {
		return this.notifService.getDashboard(dto);
	}

	exportSurveys(academicPeriodId: number, programId?: number) {
		return this.notifService.exportSurveys(academicPeriodId, programId);
	}
}
