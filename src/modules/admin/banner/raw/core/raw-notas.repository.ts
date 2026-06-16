import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawNotasEntity } from '../model/raw-notas.entity';

export interface RawNotasInsert {
	runId: string;
	nivel: string;
	periodo: string;
	codigoAlumno: string;
	cursoCodigo: string;
	payload: any;
	payloadHash: string;
}

@Injectable()
export class RawNotasRepository {
	constructor(
		@InjectRepository(RawNotasEntity, 'raw')
		private readonly repository: Repository<RawNotasEntity>,
	) {}

	async bulkInsert(rows: RawNotasInsert[]): Promise<void> {
		if (rows.length === 0) return;
		await this.repository.createQueryBuilder().insert().values(rows).orIgnore().execute();
	}
}
