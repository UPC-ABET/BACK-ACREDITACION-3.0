import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { FindingActionEntity } from '../model/finding-actions.entity';

export class FindingActionRepository extends BaseRepository {
	constructor(
		@InjectRepository(FindingActionEntity)
		repository: Repository<FindingActionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
