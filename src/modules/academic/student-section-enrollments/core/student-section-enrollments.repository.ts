import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudentSectionEnrollmentEntity } from '../model/student-section-enrollments.entity';

export class StudentSectionEnrollmentRepository extends BaseRepository {
	constructor(
		@InjectRepository(StudentSectionEnrollmentEntity)
		repository: Repository<StudentSectionEnrollmentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
