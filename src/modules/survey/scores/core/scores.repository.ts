import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ScoreEntity } from '../model/scores.entity';

export class ScoreRepository extends BaseRepository {
	constructor(
		@InjectRepository(ScoreEntity)
		repository: Repository<ScoreEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
