import { Module } from '@nestjs/common';

import { PeriodsModule } from './periods/periods.module';
import { ProgramCommissionsConfigModule } from './program-commissions/program-commissions.module';

@Module({
	imports: [PeriodsModule, ProgramCommissionsConfigModule],
})
export class ConfigurationModule {}
