import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricQuestionCriteriaEntity } from './model/rubric-question-criterias.entity';
import { RubricQuestionCriteriaRepository } from './core/rubric-question-criterias.repository';
import { RubricQuestionCriteriaService } from './api/rubric-question-criterias.service';
import { RubricQuestionCriteriaController } from './api/rubric-question-criterias.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RubricQuestionCriteriaEntity])],
	controllers: [RubricQuestionCriteriaController],
	providers: [RubricQuestionCriteriaService, RubricQuestionCriteriaRepository],
	exports: [RubricQuestionCriteriaService, RubricQuestionCriteriaRepository],
})
export class RubricQuestionCriteriaModule {}
