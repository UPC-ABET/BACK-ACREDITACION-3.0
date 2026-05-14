import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { FindingEntity } from '../model/findings.entity';

export class FindingRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(FindingEntity)
		repository: Repository<FindingEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
