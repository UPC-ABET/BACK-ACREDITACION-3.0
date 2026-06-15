import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawMatriculaEntity } from '../model/raw-matricula.entity';

export interface RawMatriculaInsert {
	runId: string;
	nivel: string;
	periodo: string;
	nrc: string;
	codigoAlumno: string | null;
	payload: any;
	payloadHash: string;
}

@Injectable()
export class RawMatriculaRepository {
	constructor(
		@InjectRepository(RawMatriculaEntity, 'raw')
		private readonly repository: Repository<RawMatriculaEntity>,
	) {}

	async bulkInsert(rows: RawMatriculaInsert[]): Promise<void> {
		if (rows.length === 0) return;
		await this.repository.createQueryBuilder().insert().values(rows).orIgnore().execute();
	}
}
