import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawPlannerEvaluacionEntity } from '../model/raw-planner-evaluacion.entity';

export interface RawPlannerEvaluacionInsert {
	runId: string;
	sectionId: string | null;
	evalComponentId: string | null;
	payload: any;
	payloadHash: string;
}

@Injectable()
export class RawPlannerEvaluacionRepository {
	constructor(
		@InjectRepository(RawPlannerEvaluacionEntity, 'planner-raw')
		private readonly repository: Repository<RawPlannerEvaluacionEntity>,
	) {}

	async bulkInsert(rows: RawPlannerEvaluacionInsert[]): Promise<void> {
		if (rows.length === 0) return;
		await this.repository.createQueryBuilder().insert().values(rows).orIgnore().execute();
	}
}
