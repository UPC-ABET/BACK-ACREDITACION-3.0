import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { RubricOutcomeCriteriaEntity } from '../model/rubric-outcome-criterias.entity';

export class RubricOutcomeCriteriaRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(RubricOutcomeCriteriaEntity)
		repository: Repository<RubricOutcomeCriteriaEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
