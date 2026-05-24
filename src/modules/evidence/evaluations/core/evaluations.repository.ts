import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { EvaluationEntity } from '../model/evaluations.entity';

export class EvaluationRepository extends BaseRepository {
	constructor(
		@InjectRepository(EvaluationEntity)
		repository: Repository<EvaluationEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
