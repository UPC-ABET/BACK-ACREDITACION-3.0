import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { SchoolEntity } from '../model/schools.entity';

export class SchoolRepository extends BaseRepository {
	constructor(
		@InjectRepository(SchoolEntity)
		repository: Repository<SchoolEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
