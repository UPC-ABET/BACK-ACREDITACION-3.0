import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { RoleEntity } from '../model/roles.entity';

export class RoleRepository extends BaseRepository<RoleEntity> {
	constructor(
		@InjectRepository(RoleEntity)
		repository: Repository<RoleEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
