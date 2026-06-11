import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './model/users.entity';
import { UserRepository } from './core/users.repository';
import { UserService } from './api/users.service';
import { UserController } from './api/users.controller';
import { UserAuthorizationService } from './api/user-authorization.service';
import { OrgScopeModule } from '../org-scope/org-scope.module';

@Module({
	imports: [TypeOrmModule.forFeature([UserEntity]), OrgScopeModule],
	controllers: [UserController],
	providers: [UserService, UserRepository, UserAuthorizationService],
	exports: [UserService, UserAuthorizationService],
})
export class UserModule {}
