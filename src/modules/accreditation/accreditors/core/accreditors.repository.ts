import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { AccreditorEntity } from '../model/accreditors.entity';

export class AccreditorRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(AccreditorEntity)
		repository: Repository<AccreditorEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
