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

	async isComiteType(evaluatorTypeId: number): Promise<boolean> {
		const [row] = await this.dataSource.query(`SELECT code FROM core.types WHERE id = $1`, [
			evaluatorTypeId,
		]);
		return row?.code === 'TG403-T001';
	}
}
