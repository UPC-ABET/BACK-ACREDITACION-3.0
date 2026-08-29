import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplateEntity } from 'src/modules/core/email-templates/model/email-templates.entity';
import { ReportModule } from 'src/libs/reporting/report.module';
import { OutcomeConversionsModule } from 'src/modules/accreditation/outcome-conversions/outcome-conversions.module';
import { SurveyEmailTemplateService } from './survey-email.service';
import { SurveyEmailTemplateRepository } from './core/survey-email-template.repository';
import { PerceptionReportService } from './perception-report.service';
import { PerceptionReportRepository } from './core/perception-report.repository';
import { SurveyConversionService } from './api/survey-conversion.service';
import { SurveyConversionRepository } from './core/survey-conversion.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmailTemplateEntity]),
		ReportModule,
		OutcomeConversionsModule,
	],
	providers: [
		SurveyEmailTemplateService,
		SurveyEmailTemplateRepository,
		PerceptionReportService,
		PerceptionReportRepository,
		SurveyConversionService,
		SurveyConversionRepository,
	],
	exports: [
		SurveyEmailTemplateService,
		SurveyEmailTemplateRepository,
		PerceptionReportService,
		SurveyConversionService,
	],
})
export class SurveySharedModule {}
