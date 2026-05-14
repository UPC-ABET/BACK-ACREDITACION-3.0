import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { StatusEntity } from '../model/statuses.entity';

export class StatusRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(StatusEntity)
		repository: Repository<StatusEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
