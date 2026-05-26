import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { RubricScoreEntity } from '../model/rubric-scores.entity';

export class RubricScoreRepository extends BaseRepository<RubricScoreEntity> {
	constructor(
		@InjectRepository(RubricScoreEntity)
		repository: Repository<RubricScoreEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
