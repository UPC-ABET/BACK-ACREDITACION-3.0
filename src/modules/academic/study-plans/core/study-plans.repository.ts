import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { StudyPlanEntity } from '../model/study-plans.entity';

export class StudyPlanRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(StudyPlanEntity)
		repository: Repository<StudyPlanEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
