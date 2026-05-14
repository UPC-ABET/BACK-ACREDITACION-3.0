import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { AcademicPeriodEntity } from '../model/academic-periods.entity';

export class AcademicPeriodRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(AcademicPeriodEntity)
		repository: Repository<AcademicPeriodEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
