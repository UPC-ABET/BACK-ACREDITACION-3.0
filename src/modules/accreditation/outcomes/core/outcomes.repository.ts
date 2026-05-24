import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { OutcomeEntity } from '../model/outcomes.entity';

export class OutcomeRepository extends BaseRepository {
	constructor(
		@InjectRepository(OutcomeEntity)
		repository: Repository<OutcomeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
