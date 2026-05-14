import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { RubricEntity } from '../model/rubrics.entity';

export class RubricRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(RubricEntity)
		repository: Repository<RubricEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
