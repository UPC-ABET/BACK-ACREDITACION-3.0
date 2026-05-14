import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { ParameterEntity } from '../model/parameters.entity';

export class ParameterRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(ParameterEntity)
		repository: Repository<ParameterEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
