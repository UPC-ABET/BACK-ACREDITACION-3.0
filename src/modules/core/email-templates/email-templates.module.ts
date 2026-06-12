import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailTemplateEntity } from './model/email-templates.entity';
import { EmailTemplateRepository } from './core/email-templates.repository';
import { EmailTemplateService } from './api/email-templates.service';
import { EmailTemplateController } from './api/email-templates.controller';

@Module({
	imports: [TypeOrmModule.forFeature([EmailTemplateEntity])],
	controllers: [EmailTemplateController],
	providers: [EmailTemplateService, EmailTemplateRepository],
	exports: [EmailTemplateService, EmailTemplateRepository],
})
export class EmailTemplateModule {}
