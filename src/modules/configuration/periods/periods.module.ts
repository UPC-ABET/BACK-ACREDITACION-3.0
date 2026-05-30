import { Module } from '@nestjs/common';

import { PeriodsService } from './api/periods.service';
import { PeriodsController } from './api/periods.controller';

@Module({
	controllers: [PeriodsController],
	providers: [PeriodsService],
	exports: [PeriodsService],
})
export class PeriodsModule {}
