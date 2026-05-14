import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { StudentEntity } from '../model/students.entity';

export class StudentRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(StudentEntity)
		repository: Repository<StudentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
