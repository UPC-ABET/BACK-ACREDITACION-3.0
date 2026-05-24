import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EvaluationEntity } from './model/evaluations.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { StudentCourseOutcomeGradeEntity } from 'src/modules/evidence/student-course-outcome-grades/model/student-course-outcome-grades.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { PerformanceLevelEntity } from 'src/modules/academic/performance-levels/model/performance-levels.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';

import { EvaluationRepository } from './core/evaluations.repository';
import { EvaluationService } from './api/evaluations.service';
import { EvaluationController } from './api/evaluations.controller';
import { EvaluationSubmissionService } from './api/evaluation-submission.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EvaluationEntity,
			ProjectStudentEntity,
			ProjectEvaluatorEntity,
			RubricQuestionCriteriaEntity,
			RubricScoreEntity,
			RubricQuestionEntity,
			RubricEntity,
			StudentCourseOutcomeGradeEntity,
			StudentSectionEnrollmentEntity,
			ProjectEntity,
			TypeEntity,
			PerformanceLevelEntity,
			StudyPlanCourseEntity,
		]),
	],
	controllers: [EvaluationController],
	providers: [EvaluationService, EvaluationRepository, EvaluationSubmissionService],
	exports: [EvaluationService, EvaluationRepository, EvaluationSubmissionService],
})
export class EvaluationModule {}
