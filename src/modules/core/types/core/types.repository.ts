import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { TypeEntity } from '../model/types.entity';

export class TypeRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(TypeEntity)
		repository: Repository<TypeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
