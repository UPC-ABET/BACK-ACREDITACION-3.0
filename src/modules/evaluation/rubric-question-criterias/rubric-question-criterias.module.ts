import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricQuestionCriteriaEntity } from './model/rubric-question-criterias.entity';
import { RubricQuestionCriteriaRepository } from './core/rubric-question-criterias.repository';

@Module({
	imports: [TypeOrmModule.forFeature([RubricQuestionCriteriaEntity])],
	controllers: [],
	providers: [RubricQuestionCriteriaRepository],
	exports: [RubricQuestionCriteriaRepository],
})
export class RubricQuestionCriteriaModule {}
