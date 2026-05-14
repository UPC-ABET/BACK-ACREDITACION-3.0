import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { TypeGroupEntity } from '../model/type-groups.entity';

export class TypeGroupRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(TypeGroupEntity)
		repository: Repository<TypeGroupEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
