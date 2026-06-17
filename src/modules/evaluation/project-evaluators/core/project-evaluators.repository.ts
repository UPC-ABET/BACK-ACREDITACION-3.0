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

	async getMaxEvaluators(evaluatorTypeId: number): Promise<number | null> {
		const [row] = await this.dataSource.query(
			`SELECT (extra->>'max_evaluators')::int AS max_evaluators FROM core.types WHERE id = $1`,
			[evaluatorTypeId],
		);
		return row?.max_evaluators ?? null;
	}

	async countActiveByType(projectId: number, evaluatorTypeId: number): Promise<number> {
		const [row] = await this.dataSource.query(
			`SELECT COUNT(*)::int AS count
			 FROM evaluation.project_evaluators
			 WHERE project_id = $1 AND evaluator_type_id = $2 AND is_active = true`,
			[projectId, evaluatorTypeId],
		);
		return row?.count ?? 0;
	}
}
