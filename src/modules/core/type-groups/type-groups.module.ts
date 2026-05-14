import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeGroupEntity } from './model/type-groups.entity';
import { TypeGroupRepository } from './core/type-groups.repository';
import { TypeGroupService } from './api/type-groups.service';
import { TypeGroupController } from './api/type-groups.controller';

@Module({
	imports: [TypeOrmModule.forFeature([TypeGroupEntity])],
	controllers: [TypeGroupController],
	providers: [TypeGroupService, TypeGroupRepository],
	exports: [TypeGroupService, TypeGroupRepository],
})
export class TypeGroupModule {}
