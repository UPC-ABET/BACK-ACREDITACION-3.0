import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';
import { LcfcConfigRepository } from './core/lcfc-config.repository';
import { LcfcSurveyRepository } from './core/lcfc-survey.repository';
import { LcfcNotificationRepository } from './core/lcfc-notification.repository';
import { MailModule } from 'src/modules/mail/mail.module';
import { SurveySharedModule } from 'src/modules/survey/shared/survey-shared.module';
import { ReportModule } from 'src/libs/reporting/report.module';
import { OutcomeConversionsModule } from 'src/modules/accreditation/outcome-conversions/outcome-conversions.module';
import { LcfcConfigService } from './api/lcfc-config.service';
import { LcfcNotificationService } from './api/lcfc-notification.service';
import { LcfcReportService } from './api/lcfc-report.service';
import { LcfcConversionService } from './api/lcfc-conversion.service';
import { LcfcService } from './api/lcfc.service';
import { LcfcController } from './api/lcfc.controller';

@Module({
	imports: [
		TypeOrmModule.forFeature([OutcomeConfigEntity, SurveyEntity, NotificationEntity]),
		MailModule,
		SurveySharedModule,
		ReportModule,
		OutcomeConversionsModule,
	],
	controllers: [LcfcController],
	providers: [
		LcfcService,
		LcfcConfigService,
		LcfcNotificationService,
		LcfcReportService,
		LcfcConversionService,
		LcfcConfigRepository,
		LcfcSurveyRepository,
		LcfcNotificationRepository,
	],
	exports: [LcfcService, LcfcConfigService, LcfcNotificationService],
})
export class LcfcModule {}
