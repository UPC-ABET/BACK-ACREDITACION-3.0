import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudyPlanAcademicPeriodEntity } from './model/study-plan-academic-periods.entity';
import { StudyPlanAcademicPeriodRepository } from './core/study-plan-academic-periods.repository';
import { StudyPlanAcademicPeriodService } from './api/study-plan-academic-periods.service';
import { StudyPlanAcademicPeriodController } from './api/study-plan-academic-periods.controller';

@Module({
	imports: [TypeOrmModule.forFeature([StudyPlanAcademicPeriodEntity])],
	controllers: [StudyPlanAcademicPeriodController],
	providers: [StudyPlanAcademicPeriodService, StudyPlanAcademicPeriodRepository],
	exports: [StudyPlanAcademicPeriodService, StudyPlanAcademicPeriodRepository],
})
export class StudyPlanAcademicPeriodModule {}
