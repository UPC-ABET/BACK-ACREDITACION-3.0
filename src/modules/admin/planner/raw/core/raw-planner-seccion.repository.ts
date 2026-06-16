import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawPlannerSeccionEntity } from '../model/raw-planner-seccion.entity';

export interface RawPlannerSeccionInsert {
	runId: string;
	periodo: string;
	sectionId: string | null;
	payload: any;
	payloadHash: string;
}

@Injectable()
export class RawPlannerSeccionRepository {
	constructor(
		@InjectRepository(RawPlannerSeccionEntity, 'planner-raw')
		private readonly repository: Repository<RawPlannerSeccionEntity>,
	) {}

	async bulkInsert(rows: RawPlannerSeccionInsert[]): Promise<void> {
		if (rows.length === 0) return;
		await this.repository.createQueryBuilder().insert().values(rows).orIgnore().execute();
	}
}
