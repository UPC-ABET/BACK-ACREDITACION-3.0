import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CourseEntity } from './model/courses.entity';
import { CourseRepository } from './core/courses.repository';
import { CourseService } from './api/courses.service';
import { CourseController } from './api/courses.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CourseEntity])],
	controllers: [CourseController],
	providers: [CourseService, CourseRepository],
	exports: [CourseService, CourseRepository],
})
export class CourseModule {}
