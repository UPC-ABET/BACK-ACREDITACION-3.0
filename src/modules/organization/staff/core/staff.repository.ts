import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StaffEntity } from '../model/staff.entity';

export class StaffRepository extends BaseRepository<StaffEntity> {
	constructor(
		@InjectRepository(StaffEntity)
		repository: Repository<StaffEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
