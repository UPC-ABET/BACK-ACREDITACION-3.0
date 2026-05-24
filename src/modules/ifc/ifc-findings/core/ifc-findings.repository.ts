import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { IfcFindingEntity } from '../model/ifc-findings.entity';

export class IfcFindingRepository extends BaseRepository {
	constructor(
		@InjectRepository(IfcFindingEntity)
		repository: Repository<IfcFindingEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
