import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';
import { PerformanceLevelsModule } from 'src/modules/survey/acceptance-levels/acceptance-levels.module';
import { MailModule } from 'src/modules/mail/mail.module';
import { SurveySharedModule } from 'src/modules/survey/shared/survey-shared.module';
import { GraConfigRepository } from './core/gra-config.repository';
import { GraSurveyRepository } from './core/gra-survey.repository';
import { GraNotificationRepository } from './core/gra-notification.repository';
import { GraConfigService } from './api/gra-config.service';
import { GraNotificationService } from './api/gra-notification.service';
import { GraService } from './api/gra.service';
import { GraController } from './api/gra.controller';

@Module({
	imports: [
		TypeOrmModule.forFeature([OutcomeConfigEntity, SurveyEntity, NotificationEntity]),
		PerformanceLevelsModule,
		MailModule,
		SurveySharedModule,
	],
	controllers: [GraController],
	providers: [
		GraService,
		GraConfigService,
		GraNotificationService,
		GraConfigRepository,
		GraSurveyRepository,
		GraNotificationRepository,
	],
	exports: [GraService, GraConfigService, GraNotificationService],
})
export class GraModule {}
