import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { ProgramCommissionEntity } from '../model/program-commissions.entity';

export class ProgramCommissionRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(ProgramCommissionEntity)
		repository: Repository<ProgramCommissionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
