import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { EnrolledStudentEntity } from '../model/enrolled-students.entity';

export class EnrolledStudentRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(EnrolledStudentEntity)
		repository: Repository<EnrolledStudentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
