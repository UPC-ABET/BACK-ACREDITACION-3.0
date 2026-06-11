import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoleModulePermissionEntity } from './model/role-module-permissions.entity';
import { RoleModulePermissionRepository } from './core/role-module-permissions.repository';
import { RoleModulePermissionService } from './api/role-module-permissions.service';
import { RoleModulePermissionController } from './api/role-module-permissions.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RoleModulePermissionEntity])],
	controllers: [RoleModulePermissionController],
	providers: [RoleModulePermissionService, RoleModulePermissionRepository],
	exports: [RoleModulePermissionService, RoleModulePermissionRepository],
})
export class RoleModulePermissionModule {}
