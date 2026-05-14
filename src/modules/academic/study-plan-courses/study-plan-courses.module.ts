import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudyPlanCourseEntity } from './model/study-plan-courses.entity';
import { StudyPlanCourseRepository } from './core/study-plan-courses.repository';
import { StudyPlanCourseService } from './api/study-plan-courses.service';
import { StudyPlanCourseController } from './api/study-plan-courses.controller';

@Module({
	imports: [TypeOrmModule.forFeature([StudyPlanCourseEntity])],
	controllers: [StudyPlanCourseController],
	providers: [StudyPlanCourseService, StudyPlanCourseRepository],
	exports: [StudyPlanCourseService, StudyPlanCourseRepository],
})
export class StudyPlanCourseModule {}
