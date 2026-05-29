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

	create(dto: CreateGraConfigDto) {
		return this.configService.create(dto);
	}

	getAll(filters?: FilterGraConfigDto) {
		return this.configService.getAll(filters);
	}

	getById(id: number) {
		return this.configService.getById(id);
	}

	update(id: number, dto: UpdateGraConfigDto) {
		return this.configService.update(id, dto);
	}

	delete(id: number) {
		return this.configService.delete(id);
	}

	replicate(dto: ReplicateGraConfigDto) {
		return this.configService.replicate(dto);
	}

	listOutcomesForSurvey(dto: ListGraSurveyOutcomesDto) {
		return this.configService.listOutcomesForSurvey(dto);
	}

	saveNotification(dto: SaveGraNotificationDto) {
		return this.notifService.saveNotification(dto);
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
}
