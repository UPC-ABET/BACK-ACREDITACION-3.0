import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { UploadLogEntity } from '../model/upload-logs.entity';

export class UploadLogRepository extends BaseRepository<UploadLogEntity> {
	constructor(
		@InjectRepository(UploadLogEntity)
		repository: Repository<UploadLogEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	// Marca el log como revertido. El borrado de filas hijas (DELETE WHERE upload_log_id = X)
	// lo ejecuta cada servicio de carga dentro de la misma transacción de rollback.
	async markRolledBack(id: number, manager?: EntityManager) {
		return await this.update(id, { status: 'ROLLED_BACK', rollback_at: new Date() }, manager);
	}
}
