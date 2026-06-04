import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { UserRoleEntity } from '../model/user-roles.entity';

export class UserRoleRepository extends BaseRepository<UserRoleEntity> {
	constructor(
		@InjectRepository(UserRoleEntity)
		repository: Repository<UserRoleEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
