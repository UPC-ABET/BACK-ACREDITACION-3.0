import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { InstrumentEntity } from '../model/instruments.entity';

export class InstrumentRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(InstrumentEntity)
		repository: Repository<InstrumentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
