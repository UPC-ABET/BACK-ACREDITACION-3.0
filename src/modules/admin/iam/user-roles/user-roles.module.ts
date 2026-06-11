import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserRoleEntity } from './model/user-roles.entity';
import { UserRoleRepository } from './core/user-roles.repository';
import { UserRoleService } from './api/user-roles.service';
import { UserRoleController } from './api/user-roles.controller';

@Module({
	imports: [TypeOrmModule.forFeature([UserRoleEntity])],
	controllers: [UserRoleController],
	providers: [UserRoleService, UserRoleRepository],
	exports: [UserRoleService, UserRoleRepository],
})
export class UserRoleModule {}
