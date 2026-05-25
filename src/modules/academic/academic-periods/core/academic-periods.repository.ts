import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { AcademicPeriodEntity } from '../model/academic-periods.entity';

export class AcademicPeriodRepository extends BaseRepository<AcademicPeriodEntity> {
	constructor(
		@InjectRepository(AcademicPeriodEntity)
		repository: Repository<AcademicPeriodEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
