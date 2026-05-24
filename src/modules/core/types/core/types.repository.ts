import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { TypeEntity } from '../model/types.entity';

export class TypeRepository extends BaseRepository {
	constructor(
		@InjectRepository(TypeEntity)
		repository: Repository<TypeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
