import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { StaffEntity } from '../model/staff.entity';

export class StaffRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(StaffEntity)
		repository: Repository<StaffEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
