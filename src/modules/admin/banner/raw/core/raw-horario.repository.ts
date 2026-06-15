import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawHorarioEntity } from '../model/raw-horario.entity';

export interface RawHorarioInsert {
	runId: string;
	nivel: string;
	periodo: string;
	departamento: string;
	nrc: string | null;
	payload: any;
	payloadHash: string;
}

@Injectable()
export class RawHorarioRepository {
	constructor(
		@InjectRepository(RawHorarioEntity, 'raw')
		private readonly repository: Repository<RawHorarioEntity>,
	) {}

	async bulkInsert(rows: RawHorarioInsert[]): Promise<void> {
		if (rows.length === 0) return;
		await this.repository.createQueryBuilder().insert().values(rows).orIgnore().execute();
	}
}
