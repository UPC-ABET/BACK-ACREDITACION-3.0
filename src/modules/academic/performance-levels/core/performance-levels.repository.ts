import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PerformanceLevelEntity } from '../model/performance-levels.entity';

export class PerformanceLevelRepository extends BaseRepository<PerformanceLevelEntity> {
	constructor(
		@InjectRepository(PerformanceLevelEntity)
		repository: Repository<PerformanceLevelEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
