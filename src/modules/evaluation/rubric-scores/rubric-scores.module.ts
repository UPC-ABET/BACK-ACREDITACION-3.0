import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricScoreEntity } from './model/rubric-scores.entity';
import { RubricScoreRepository } from './core/rubric-scores.repository';
import { RubricScoreService } from './api/rubric-scores.service';
import { RubricScoreController } from './api/rubric-scores.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RubricScoreEntity])],
	controllers: [RubricScoreController],
	providers: [RubricScoreService, RubricScoreRepository],
	exports: [RubricScoreService, RubricScoreRepository],
})
export class RubricScoreModule {}
