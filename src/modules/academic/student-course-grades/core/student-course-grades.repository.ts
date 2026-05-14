import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { StudentCourseGradeEntity } from '../model/student-course-grades.entity';

export class StudentCourseGradeRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(StudentCourseGradeEntity)
		repository: Repository<StudentCourseGradeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
