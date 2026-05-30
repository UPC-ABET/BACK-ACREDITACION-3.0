import { Module } from '@nestjs/common';

import { StudyPlanPeriodsService } from './api/study-plan-periods.service';
import { StudyPlanPeriodsController } from './api/study-plan-periods.controller';

@Module({
	controllers: [StudyPlanPeriodsController],
	providers: [StudyPlanPeriodsService],
	exports: [StudyPlanPeriodsService],
})
export class StudyPlanPeriodsModule {}
