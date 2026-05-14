import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EvaluationEntity } from './model/evaluations.entity';
import { EvaluationRepository } from './core/evaluations.repository';
import { EvaluationService } from './api/evaluations.service';
import { EvaluationController } from './api/evaluations.controller';

@Module({
	imports: [TypeOrmModule.forFeature([EvaluationEntity])],
	controllers: [EvaluationController],
	providers: [EvaluationService, EvaluationRepository],
	exports: [EvaluationService, EvaluationRepository],
})
export class EvaluationModule {}
