import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudentEntity } from '../model/students.entity';

export class StudentRepository extends BaseRepository<StudentEntity> {
	constructor(
		@InjectRepository(StudentEntity)
		repository: Repository<StudentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
