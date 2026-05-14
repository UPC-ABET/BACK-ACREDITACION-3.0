import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { PlanActionEntity } from '../model/plan-actions.entity';

export class PlanActionRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(PlanActionEntity)
		repository: Repository<PlanActionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
