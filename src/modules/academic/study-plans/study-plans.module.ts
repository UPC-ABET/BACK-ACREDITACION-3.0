import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudyPlanEntity } from './model/study-plans.entity';
import { StudyPlanRepository } from './core/study-plans.repository';
import { StudyPlanService } from './api/study-plans.service';
import { StudyPlanController } from './api/study-plans.controller';

@Module({
	imports: [TypeOrmModule.forFeature([StudyPlanEntity])],
	controllers: [StudyPlanController],
	providers: [StudyPlanService, StudyPlanRepository],
	exports: [StudyPlanService, StudyPlanRepository],
})
export class StudyPlanModule {}
