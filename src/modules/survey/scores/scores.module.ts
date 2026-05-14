import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScoreEntity } from './model/scores.entity';
import { ScoreRepository } from './core/scores.repository';
import { ScoreService } from './api/scores.service';
import { ScoreController } from './api/scores.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ScoreEntity])],
	controllers: [ScoreController],
	providers: [ScoreService, ScoreRepository],
	exports: [ScoreService, ScoreRepository],
})
export class ScoreModule {}
