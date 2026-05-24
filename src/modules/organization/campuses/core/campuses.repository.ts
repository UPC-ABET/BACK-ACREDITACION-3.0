import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { CampusEntity } from '../model/campuses.entity';

export class CampusRepository extends BaseRepository {
	constructor(
		@InjectRepository(CampusEntity)
		repository: Repository<CampusEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
