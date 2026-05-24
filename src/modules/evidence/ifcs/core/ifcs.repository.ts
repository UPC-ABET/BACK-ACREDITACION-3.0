import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { IfcEntity } from '../model/ifcs.entity';

export class IfcRepository extends BaseRepository {
	constructor(
		@InjectRepository(IfcEntity)
		repository: Repository<IfcEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
