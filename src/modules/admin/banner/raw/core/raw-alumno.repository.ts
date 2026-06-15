import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawAlumnoEntity } from '../model/raw-alumno.entity';

export interface RawAlumnoInsert {
	runId: string;
	nivel: string;
	codigoAlumno: string;
	payload: any;
	payloadHash: string;
}

@Injectable()
export class RawAlumnoRepository {
	constructor(
		@InjectRepository(RawAlumnoEntity, 'raw')
		private readonly repository: Repository<RawAlumnoEntity>,
	) {}

	async bulkInsert(rows: RawAlumnoInsert[]): Promise<void> {
		if (rows.length === 0) return;
		await this.repository.createQueryBuilder().insert().values(rows).orIgnore().execute();
	}
}
