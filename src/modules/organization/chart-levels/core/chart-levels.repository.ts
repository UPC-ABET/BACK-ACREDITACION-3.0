import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ChartLevelEntity } from '../model/chart-levels.entity';

export class ChartLevelRepository extends BaseRepository<ChartLevelEntity> {
	constructor(
		@InjectRepository(ChartLevelEntity)
		repository: Repository<ChartLevelEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
