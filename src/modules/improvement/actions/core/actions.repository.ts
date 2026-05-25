import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ActionEntity } from '../model/actions.entity';

export class ActionRepository extends BaseRepository<ActionEntity> {
	constructor(
		@InjectRepository(ActionEntity)
		repository: Repository<ActionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
