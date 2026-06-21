import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplateEntity } from 'src/modules/core/email-templates/model/email-templates.entity';
import { SurveyEmailTemplateService } from './survey-email.service';
import { SurveyEmailTemplateRepository } from './core/survey-email-template.repository';

@Module({
	imports: [TypeOrmModule.forFeature([EmailTemplateEntity])],
	providers: [SurveyEmailTemplateService, SurveyEmailTemplateRepository],
	exports: [SurveyEmailTemplateService, SurveyEmailTemplateRepository],
})
export class SurveySharedModule {}
