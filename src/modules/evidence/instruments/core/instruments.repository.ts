import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { InstrumentEntity } from '../model/instruments.entity';

export class InstrumentRepository extends BaseRepository {
	constructor(
		@InjectRepository(InstrumentEntity)
		repository: Repository<InstrumentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
