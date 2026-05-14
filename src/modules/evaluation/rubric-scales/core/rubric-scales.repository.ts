import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { RubricScaleEntity } from '../model/rubric-scales.entity';

export class RubricScaleRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(RubricScaleEntity)
		repository: Repository<RubricScaleEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
