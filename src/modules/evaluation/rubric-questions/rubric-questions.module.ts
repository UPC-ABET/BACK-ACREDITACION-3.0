import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricQuestionEntity } from './model/rubric-questions.entity';
import { RubricQuestionRepository } from './core/rubric-questions.repository';
import { RubricQuestionService } from './api/rubric-questions.service';
import { RubricQuestionController } from './api/rubric-questions.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RubricQuestionEntity])],
	controllers: [RubricQuestionController],
	providers: [RubricQuestionService, RubricQuestionRepository],
	exports: [RubricQuestionService, RubricQuestionRepository],
})
export class RubricQuestionModule {}
