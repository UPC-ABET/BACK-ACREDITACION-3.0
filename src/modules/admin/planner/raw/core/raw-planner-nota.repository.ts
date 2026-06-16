import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawPlannerNotaEntity } from '../model/raw-planner-nota.entity';

export interface RawPlannerNotaInsert {
	runId: string;
	sectionId: string | null;
	componentId: string | null;
	studentCode: string | null;
	payload: any;
	payloadHash: string;
}

@Injectable()
export class RawPlannerNotaRepository {
	constructor(
		@InjectRepository(RawPlannerNotaEntity, 'planner-raw')
		private readonly repository: Repository<RawPlannerNotaEntity>,
	) {}

	async bulkInsert(rows: RawPlannerNotaInsert[]): Promise<void> {
		if (rows.length === 0) return;
		await this.repository.createQueryBuilder().insert().values(rows).orIgnore().execute();
	}
}
