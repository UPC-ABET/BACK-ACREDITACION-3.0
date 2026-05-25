import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProjectEvaluatorEntity } from '../model/project-evaluators.entity';

export class ProjectEvaluatorRepository extends BaseRepository<ProjectEvaluatorEntity> {
	constructor(
		@InjectRepository(ProjectEvaluatorEntity)
		repository: Repository<ProjectEvaluatorEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
