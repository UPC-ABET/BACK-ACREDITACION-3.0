import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';
import { LcfcConfigRepository } from './core/lcfc-config.repository';
import { LcfcSurveyRepository } from './core/lcfc-survey.repository';
import { LcfcNotificationRepository } from './core/lcfc-notification.repository';
import { LcfcConfigService } from './api/lcfc-config.service';
import { LcfcNotificationService } from './api/lcfc-notification.service';
import { LcfcController } from './api/lcfc.controller';

@Module({
	imports: [TypeOrmModule.forFeature([OutcomeConfigEntity, SurveyEntity, NotificationEntity])],
	controllers: [LcfcController],
	providers: [LcfcConfigService, LcfcNotificationService, LcfcConfigRepository, LcfcSurveyRepository, LcfcNotificationRepository],
	exports: [LcfcConfigService, LcfcNotificationService],
})
export class LcfcModule {}
