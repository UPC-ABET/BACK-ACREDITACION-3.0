import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { StudyPlanAcademicPeriodEntity } from '../model/study-plan-academic-periods.entity';

export class StudyPlanAcademicPeriodRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(StudyPlanAcademicPeriodEntity)
		repository: Repository<StudyPlanAcademicPeriodEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
