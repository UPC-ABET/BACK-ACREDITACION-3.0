import { Module } from '@nestjs/common';
import { SurveyEmailService } from './survey-email.service';

@Module({
	providers: [SurveyEmailService],
	exports: [SurveyEmailService],
})
export class SurveySharedModule {}
