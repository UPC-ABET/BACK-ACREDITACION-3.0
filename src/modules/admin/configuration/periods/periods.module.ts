import { Module } from '@nestjs/common';

import { AcademicPeriodModule } from 'src/modules/academic/academic-periods/academic-periods.module';
import { PeriodsController } from './api/periods.controller';

@Module({
	imports: [AcademicPeriodModule],
	controllers: [PeriodsController],
})
export class PeriodsModule {}
