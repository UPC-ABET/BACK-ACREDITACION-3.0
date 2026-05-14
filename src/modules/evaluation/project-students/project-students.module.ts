import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectStudentEntity } from './model/project-students.entity';
import { ProjectStudentRepository } from './core/project-students.repository';
import { ProjectStudentService } from './api/project-students.service';
import { ProjectStudentController } from './api/project-students.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ProjectStudentEntity])],
	controllers: [ProjectStudentController],
	providers: [ProjectStudentService, ProjectStudentRepository],
	exports: [ProjectStudentService, ProjectStudentRepository],
})
export class ProjectStudentModule {}
