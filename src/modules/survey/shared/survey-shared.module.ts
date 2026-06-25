import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplateEntity } from 'src/modules/core/email-templates/model/email-templates.entity';
import { ReportModule } from 'src/libs/reporting/report.module';
import { SurveyEmailTemplateService } from './survey-email.service';
import { SurveyEmailTemplateRepository } from './core/survey-email-template.repository';
import { PerceptionReportService } from './perception-report.service';
import { PerceptionReportRepository } from './core/perception-report.repository';

@Module({
	imports: [TypeOrmModule.forFeature([EmailTemplateEntity]), ReportModule],
	providers: [
		SurveyEmailTemplateService,
		SurveyEmailTemplateRepository,
		PerceptionReportService,
		PerceptionReportRepository,
	],
	exports: [SurveyEmailTemplateService, SurveyEmailTemplateRepository, PerceptionReportService],
})
export class SurveySharedModule {}
