import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './model/users.entity';
import { UserRepository } from './core/users.repository';
import { UserService } from './api/users.service';
import { UserController } from './api/users.controller';
import { UserAuthorizationService } from './api/user-authorization.service';
import { OrgScopeModule } from '../org-scope/org-scope.module';
import { MailModule } from 'src/modules/mail/mail.module';
import { EmailTemplateModule } from 'src/modules/core/email-templates/email-templates.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([UserEntity]),
		OrgScopeModule,
		MailModule,
		EmailTemplateModule,
	],
	controllers: [UserController],
	providers: [UserService, UserRepository, UserAuthorizationService],
	exports: [UserService, UserAuthorizationService],
})
export class UserModule {}
