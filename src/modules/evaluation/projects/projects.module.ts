import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectEntity } from './model/projects.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { ProjectRepository } from './core/projects.repository';
import { ProjectService } from './api/projects.service';
import { ProjectController } from './api/projects.controller';
import { ProjectConfigService } from './api/project-config.service';
import { ProjectDetailsService } from './api/project-details.service';
import { ProjectGradeExportService } from './api/project-grade-export.service';
import { ProjectGradeSupportService } from './api/project-grade-support.service';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { RubricModule } from 'src/modules/evaluation/rubrics/rubrics.module';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			ProjectEntity,
			ProjectStudentEntity,
			ProjectEvaluatorEntity,
			TypeEntity,
			StudyPlanCourseEntity,
			StudentSectionEnrollmentEntity,
		]),
		forwardRef(() => RubricModule),
	],
	controllers: [ProjectController],
	providers: [
		ProjectService,
		ProjectRepository,
		ProjectConfigService,
		ProjectDetailsService,
		ProjectGradeExportService,
		ProjectGradeSupportService,
	],
	exports: [
		ProjectService,
		ProjectRepository,
		ProjectConfigService,
		ProjectDetailsService,
		ProjectGradeExportService,
	],
})
export class ProjectModule {}
