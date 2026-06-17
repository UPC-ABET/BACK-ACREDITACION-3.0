import { Injectable } from '@nestjs/common';
import { LcfcConfigService } from './lcfc-config.service';
import { LcfcNotificationService } from './lcfc-notification.service';
import {
	GenerateLcfcConfigDto,
	CloneLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
	UpdateLcfcConfigDto,
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
	) {}

	generateConfigs(dto: GenerateLcfcConfigDto, schoolId: number) {
		return this.configService.generateConfigs(dto, schoolId);
	}

	getAllConfigs(filters?: FilterLcfcConfigDto) {
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

	getAvailableSections(programId: number, academicPeriodId: number) {
		return this.configService.getAvailableSections(programId, academicPeriodId);
	}

	getSectionOutcomes(courseSectionId: number, programId: number) {
		return this.configService.getSectionOutcomes(courseSectionId, programId);
	}

	sendNotifications(dto: SendLcfcNotificationDto) {
		return this.notifService.sendNotifications(dto);
	}

	validateToken(token: string) {
		return this.notifService.validateToken(token);
	}

	getSurveyByToken(dto: GetLcfcSurveyByTokenDto) {
		return this.notifService.getSurveyByToken(dto);
	}

	completeSurvey(dto: CompleteLcfcSurveyDto) {
		return this.notifService.completeSurvey(dto);
	}

	getDashboard(dto: DashboardLcfcDto) {
		return this.notifService.getDashboard(dto);
	}
}
