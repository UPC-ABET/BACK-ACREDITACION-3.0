import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CourseOutcomeMappingEntity } from './model/course-outcome-mappings.entity';
import { CourseOutcomeMappingRepository } from './core/course-outcome-mappings.repository';
import { CourseOutcomeMappingService } from './api/course-outcome-mappings.service';
import { CourseOutcomeMappingController } from './api/course-outcome-mappings.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CourseOutcomeMappingEntity])],
	controllers: [CourseOutcomeMappingController],
	providers: [CourseOutcomeMappingService, CourseOutcomeMappingRepository],
	exports: [CourseOutcomeMappingService, CourseOutcomeMappingRepository],
})
export class CourseOutcomeMappingModule {}
