import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricScoreEntity } from './model/rubric-scores.entity';

@Module({
	imports: [TypeOrmModule.forFeature([RubricScoreEntity])],
})
export class RubricScoreModule {}
