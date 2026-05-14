import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudentCourseOutcomeGradeEntity } from './model/student-course-outcome-grades.entity';
import { StudentCourseOutcomeGradeRepository } from './core/student-course-outcome-grades.repository';
import { StudentCourseOutcomeGradeService } from './api/student-course-outcome-grades.service';
import { StudentCourseOutcomeGradeController } from './api/student-course-outcome-grades.controller';

@Module({
	imports: [TypeOrmModule.forFeature([StudentCourseOutcomeGradeEntity])],
	controllers: [StudentCourseOutcomeGradeController],
	providers: [StudentCourseOutcomeGradeService, StudentCourseOutcomeGradeRepository],
	exports: [StudentCourseOutcomeGradeService, StudentCourseOutcomeGradeRepository],
})
export class StudentCourseOutcomeGradeModule {}
