import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricQuestionEntity } from './model/rubric-questions.entity';
import { RubricQuestionRepository } from './core/rubric-questions.repository';

@Module({
	imports: [TypeOrmModule.forFeature([RubricQuestionEntity])],
	controllers: [],
	providers: [RubricQuestionRepository],
	exports: [RubricQuestionRepository],
})
export class RubricQuestionModule {}
