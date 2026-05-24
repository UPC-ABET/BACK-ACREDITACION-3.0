import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProgramCommissionEntity } from '../model/program-commissions.entity';

export class ProgramCommissionRepository extends BaseRepository {
	constructor(
		@InjectRepository(ProgramCommissionEntity)
		repository: Repository<ProgramCommissionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
