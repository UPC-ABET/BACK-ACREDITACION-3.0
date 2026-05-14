import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudentCourseGradeEntity } from './model/student-course-grades.entity';
import { StudentCourseGradeRepository } from './core/student-course-grades.repository';
import { StudentCourseGradeService } from './api/student-course-grades.service';
import { StudentCourseGradeController } from './api/student-course-grades.controller';

@Module({
	imports: [TypeOrmModule.forFeature([StudentCourseGradeEntity])],
	controllers: [StudentCourseGradeController],
	providers: [StudentCourseGradeService, StudentCourseGradeRepository],
	exports: [StudentCourseGradeService, StudentCourseGradeRepository],
})
export class StudentCourseGradeModule {}
