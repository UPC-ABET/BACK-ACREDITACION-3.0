import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';
import { MailModule } from 'src/modules/mail/mail.module';
import { SurveySharedModule } from 'src/modules/survey/shared/survey-shared.module';
import { ReportModule } from 'src/libs/reporting/report.module';
import { GraConfigRepository } from './core/gra-config.repository';
import { GraSurveyRepository } from './core/gra-survey.repository';
import { GraNotificationRepository } from './core/gra-notification.repository';
import { GraConfigService } from './api/gra-config.service';
import { GraNotificationService } from './api/gra-notification.service';
import { GraReportService } from './api/gra-report.service';
import { GraService } from './api/gra.service';
import { GraController } from './api/gra.controller';
import { PerformanceLevelModule } from 'src/modules/academic/performance-levels/performance-levels.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([OutcomeConfigEntity, SurveyEntity, NotificationEntity]),
		PerformanceLevelModule,
		MailModule,
		SurveySharedModule,
		ReportModule,
	],
	controllers: [GraController],
	providers: [
		GraService,
		GraConfigService,
		GraNotificationService,
		GraReportService,
		GraConfigRepository,
		GraSurveyRepository,
		GraNotificationRepository,
	],
	exports: [GraService, GraConfigService, GraNotificationService],
})
export class GraModule {}
