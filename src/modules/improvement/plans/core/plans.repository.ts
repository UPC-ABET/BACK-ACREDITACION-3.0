import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { PlanEntity } from '../model/plans.entity';

export class PlanRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(PlanEntity)
		repository: Repository<PlanEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
