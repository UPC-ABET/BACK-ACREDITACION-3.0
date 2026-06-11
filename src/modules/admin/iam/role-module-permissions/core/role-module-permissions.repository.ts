import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { RoleModulePermissionEntity } from '../model/role-module-permissions.entity';

export class RoleModulePermissionRepository extends BaseRepository<RoleModulePermissionEntity> {
	constructor(
		@InjectRepository(RoleModulePermissionEntity)
		repository: Repository<RoleModulePermissionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
