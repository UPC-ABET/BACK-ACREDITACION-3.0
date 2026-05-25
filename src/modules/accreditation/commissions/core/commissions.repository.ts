import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { CommissionEntity } from '../model/commissions.entity';

export class CommissionRepository extends BaseRepository<CommissionEntity> {
	constructor(
		@InjectRepository(CommissionEntity)
		repository: Repository<CommissionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
