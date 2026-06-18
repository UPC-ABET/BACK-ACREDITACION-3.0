import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CourseOutcomeMappingEntity } from './model/course-outcome-mappings.entity';
import { CourseOutcomeMappingRepository } from './core/course-outcome-mappings.repository';
import { CourseOutcomeMappingService } from './api/course-outcome-mappings.service';
import { ArticulationReportService } from './api/articulation-report.service';
import { CourseOutcomeMappingController } from './api/course-outcome-mappings.controller';
import { ReportModule } from 'src/libs/reporting/report.module';

@Module({
	imports: [TypeOrmModule.forFeature([CourseOutcomeMappingEntity]), ReportModule],
	controllers: [CourseOutcomeMappingController],
	providers: [
		CourseOutcomeMappingService,
		ArticulationReportService,
		CourseOutcomeMappingRepository,
	],
	exports: [CourseOutcomeMappingService, CourseOutcomeMappingRepository],
})
export class CourseOutcomeMappingModule {}
