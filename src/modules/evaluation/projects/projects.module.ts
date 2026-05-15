import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectEntity } from './model/projects.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { ProjectRepository } from './core/projects.repository';
import { ProjectService } from './api/projects.service';
import { ProjectController } from './api/projects.controller';
import { ProjectConfigService } from './api/project-config.service';

@Module({
	imports: [TypeOrmModule.forFeature([ProjectEntity, ProjectStudentEntity, ProjectEvaluatorEntity])],
	controllers: [ProjectController],
	providers: [ProjectService, ProjectRepository, ProjectConfigService],
	exports: [ProjectService, ProjectRepository, ProjectConfigService],
})
export class ProjectModule {}
