import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';
import { GraConfigRepository } from './core/gra-config.repository';
import { GraSurveyRepository } from './core/gra-survey.repository';
import { GraNotificationRepository } from './core/gra-notification.repository';
import { GraConfigService } from './api/gra-config.service';
import { GraNotificationService } from './api/gra-notification.service';
import { GraController } from './api/gra.controller';

@Module({
	imports: [TypeOrmModule.forFeature([OutcomeConfigEntity, SurveyEntity, NotificationEntity])],
	controllers: [GraController],
	providers: [GraConfigService, GraNotificationService, GraConfigRepository, GraSurveyRepository, GraNotificationRepository],
	exports: [GraConfigService, GraNotificationService],
})
export class GraModule {}
