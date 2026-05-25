import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { FacultyEntity } from '../model/faculties.entity';

export class FacultyRepository extends BaseRepository<FacultyEntity> {
	constructor(
		@InjectRepository(FacultyEntity)
		repository: Repository<FacultyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
