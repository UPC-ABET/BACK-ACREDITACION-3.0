import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectGroupEntity } from './model/project-groups.entity';
import { ProjectGroupRepository } from './core/project-groups.repository';
import { ProjectGroupService } from './api/project-groups.service';
import { ProjectGroupController } from './api/project-groups.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ProjectGroupEntity])],
	controllers: [ProjectGroupController],
	providers: [ProjectGroupService, ProjectGroupRepository],
	exports: [ProjectGroupService, ProjectGroupRepository],
})
export class ProjectGroupModule {}
