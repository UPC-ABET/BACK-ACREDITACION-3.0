import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectEvaluatorEntity } from './model/project-evaluators.entity';
import { ProjectEvaluatorRepository } from './core/project-evaluators.repository';
import { ProjectEvaluatorService } from './api/project-evaluators.service';
import { ProjectEvaluatorController } from './api/project-evaluators.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ProjectEvaluatorEntity])],
	controllers: [ProjectEvaluatorController],
	providers: [ProjectEvaluatorService, ProjectEvaluatorRepository],
	exports: [ProjectEvaluatorService, ProjectEvaluatorRepository],
})
export class ProjectEvaluatorModule {}
