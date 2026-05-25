import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { FindingEntity } from '../model/findings.entity';

export class FindingRepository extends BaseRepository<FindingEntity> {
	constructor(
		@InjectRepository(FindingEntity)
		repository: Repository<FindingEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
