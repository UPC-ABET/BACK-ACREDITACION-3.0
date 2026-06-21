import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { EvaluationEntity } from '../model/evaluations.entity';

export class EvaluationRepository extends BaseRepository<EvaluationEntity> {
	constructor(
		@InjectRepository(EvaluationEntity)
		repository: Repository<EvaluationEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	runInTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}
}
