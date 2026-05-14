import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { ProfessorEntity } from '../model/professors.entity';

export class ProfessorRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(ProfessorEntity)
		repository: Repository<ProfessorEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
