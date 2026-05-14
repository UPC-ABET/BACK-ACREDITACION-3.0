import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectEntity } from './model/projects.entity';
import { ProjectRepository } from './core/projects.repository';
import { ProjectService } from './api/projects.service';
import { ProjectController } from './api/projects.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ProjectEntity])],
	controllers: [ProjectController],
	providers: [ProjectService, ProjectRepository],
	exports: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
