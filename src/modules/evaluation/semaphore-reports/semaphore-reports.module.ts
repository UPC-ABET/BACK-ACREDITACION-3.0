import { Module } from '@nestjs/common';
import { ReportModule } from 'src/libs/reporting/report.module';
import { SemaphoreReportsController } from './api/semaphore-reports.controller';
import { SemaphoreReportsService } from './api/semaphore-reports.service';
import { SemaphoreReportsRepository } from './core/semaphore-reports.repository';

@Module({
	imports: [ReportModule],
	controllers: [SemaphoreReportsController],
	providers: [SemaphoreReportsService, SemaphoreReportsRepository],
	exports: [SemaphoreReportsService, SemaphoreReportsRepository],
})
export class SemaphoreReportsModule {}
