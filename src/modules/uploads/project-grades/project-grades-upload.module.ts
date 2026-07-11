import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { PerformanceLevelEntity } from 'src/modules/academic/performance-levels/model/performance-levels.entity';
import { EvaluationModule } from 'src/modules/evidence/evaluations/evaluations.module';
import { UploadLogModule } from '../upload-logs/upload-logs.module';

import { ProjectGradesUploadService } from './api/project-grades-upload.service';
import { ProjectGradesUploadController } from './api/project-grades-upload.controller';
import { ProjectGradesUploadRepository } from './core/project-grades-upload.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			RubricEntity,
			StudyPlanCourseEntity,
			ProjectEntity,
			ProfessorEntity,
			AcademicPeriodEntity,
			TypeEntity,
			PerformanceLevelEntity,
		]),
		EvaluationModule,
		UploadLogModule,
	],
	controllers: [ProjectGradesUploadController],
	providers: [ProjectGradesUploadService, ProjectGradesUploadRepository],
	exports: [ProjectGradesUploadService],
})
export class ProjectGradesUploadModule {}
