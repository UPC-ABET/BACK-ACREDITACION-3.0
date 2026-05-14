import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { RubricScoreEntity } from '../model/rubric-scores.entity';

export class RubricScoreRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(RubricScoreEntity)
		repository: Repository<RubricScoreEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
