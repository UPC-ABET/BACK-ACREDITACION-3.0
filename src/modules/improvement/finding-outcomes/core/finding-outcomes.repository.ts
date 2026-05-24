import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { FindingOutcomeEntity } from '../model/finding-outcomes.entity';

export class FindingOutcomeRepository extends BaseRepository {
	constructor(
		@InjectRepository(FindingOutcomeEntity)
		repository: Repository<FindingOutcomeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
