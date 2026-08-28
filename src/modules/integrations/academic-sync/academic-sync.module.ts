import { Module } from '@nestjs/common';
import { AcademicPeriodModule } from 'src/modules/academic/academic-periods/academic-periods.module';
import { CampusModule } from 'src/modules/organization/campuses/campuses.module';
import { StudyPlanCourseModule } from 'src/modules/academic/study-plan-courses/study-plan-courses.module';
import { CourseSectionModule } from 'src/modules/academic/course-sections/course-sections.module';
import { AcademicSyncController } from './api/academic-sync.controller';
import { AcademicSyncService } from './api/academic-sync.service';
import { AcademicSyncRepository } from './core/academic-sync.repository';

@Module({
	imports: [AcademicPeriodModule, CampusModule, StudyPlanCourseModule, CourseSectionModule],
	controllers: [AcademicSyncController],
	providers: [AcademicSyncService, AcademicSyncRepository],
	exports: [AcademicSyncService, AcademicSyncRepository],
})
export class AcademicSyncModule {}
