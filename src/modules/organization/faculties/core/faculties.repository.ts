import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { FacultyEntity } from '../model/faculties.entity';

export class FacultyRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(FacultyEntity)
		repository: Repository<FacultyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
