import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ChartEntity } from '../model/charts.entity';

export class ChartRepository extends BaseRepository<ChartEntity> {
	constructor(
		@InjectRepository(ChartEntity)
		repository: Repository<ChartEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
