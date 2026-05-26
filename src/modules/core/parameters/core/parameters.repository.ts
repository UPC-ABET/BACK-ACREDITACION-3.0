import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ParameterEntity } from '../model/parameters.entity';

export class ParameterRepository extends BaseRepository<ParameterEntity> {
	constructor(
		@InjectRepository(ParameterEntity)
		repository: Repository<ParameterEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
