import { Module } from '@nestjs/common';

import { PeriodsModule } from './periods/periods.module';
import { StudyPlanPeriodsModule } from './study-plan-periods/study-plan-periods.module';
import { ProgramCommissionsModule } from './program-commissions/program-commissions.module';

// Aggregator for the Phase-0 configuration domain (period opening, study-plan and
// program-commission associations). Register ConfigurationModule in the root module.
@Module({
	imports: [PeriodsModule, StudyPlanPeriodsModule, ProgramCommissionsModule],
})
export class ConfigurationModule {}
