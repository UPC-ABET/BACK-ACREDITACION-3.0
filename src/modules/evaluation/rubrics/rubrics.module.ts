import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricEntity } from './model/rubrics.entity';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { ProgramCommissionEntity } from 'src/modules/accreditation/program-commissions/model/program-commissions.entity';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';

import { RubricRepository } from './core/rubrics.repository';
import { RubricService } from './api/rubrics.service';
import { RubricController } from './api/rubrics.controller';
import { RubricConfigService } from './api/rubric-config.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			RubricEntity,
			RubricQuestionEntity,
			RubricQuestionCriteriaEntity,
			StudyPlanCourseEntity,
			TypeEntity,
			ProgramCommissionEntity,
			OutcomeEntity,
		]),
	],
	controllers: [RubricController],
	providers: [RubricService, RubricRepository, RubricConfigService],
	exports: [RubricService, RubricRepository, RubricConfigService],
})
export class RubricModule {}
