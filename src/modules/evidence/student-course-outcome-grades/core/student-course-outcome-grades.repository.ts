import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { StudentCourseOutcomeGradeEntity } from '../model/student-course-outcome-grades.entity';

export class StudentCourseOutcomeGradeRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(StudentCourseOutcomeGradeEntity)
		repository: Repository<StudentCourseOutcomeGradeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
