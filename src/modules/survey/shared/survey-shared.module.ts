import { Module } from '@nestjs/common';
import { SurveyEmailTemplateService } from './survey-email.service';

@Module({
	providers: [SurveyEmailTemplateService],
	exports: [SurveyEmailTemplateService],
})
export class SurveySharedModule {}
