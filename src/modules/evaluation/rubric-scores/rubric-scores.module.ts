import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricScoreEntity } from './model/rubric-scores.entity';
import { RubricScoreRepository } from './core/rubric-scores.repository';

@Module({
	imports: [TypeOrmModule.forFeature([RubricScoreEntity])],
	controllers: [],
	providers: [RubricScoreRepository],
	exports: [RubricScoreRepository],
})
export class RubricScoreModule {}
