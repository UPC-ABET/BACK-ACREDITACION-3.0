import { Injectable } from '@nestjs/common';
import { LcfcConfigService } from './lcfc-config.service';
import { LcfcNotificationService } from './lcfc-notification.service';
import {
	GenerateLcfcConfigDto,
	CloneLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
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

	generateConfigs(dto: GenerateLcfcConfigDto) {
		return this.configService.generateConfigs(dto);
	}

	getAllConfigs(filters?: FilterLcfcConfigDto) {
		return this.configService.getAll(filters);
	}

	updateConfigStatus(dto: UpdateLcfcConfigStatusDto) {
		return this.configService.updateStatus(dto);
	}

	cloneConfig(dto: CloneLcfcConfigDto) {
		return this.configService.cloneConfig(dto);
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
