import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoleEntity } from './model/roles.entity';
import { RoleRepository } from './core/roles.repository';
import { RoleService } from './api/roles.service';
import { RoleController } from './api/roles.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RoleEntity])],
	controllers: [RoleController],
	providers: [RoleService, RoleRepository],
	exports: [RoleService, RoleRepository],
})
export class RoleModule {}
