import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { DataSource, EntityManager } from 'typeorm';
import { UploadLogRepository } from '../core/upload-logs.repository';
import { CreateUploadLogDto } from '../model/upload-logs.dtos';

// Filtros de la Vista 4.3 (historial).
export interface ListUploadLogsFilters {
	uploadType?: string;
	status?: string;
	academicPeriodId?: number;
	limit: number;
	offset: number;
}

export interface UploadLogListItem {
	id: number;
	upload_type: string;
	status: string;
	academic_period_id: number | null;
	user_id: number | null;
	source_file: string | null;
	total_rows: number | null;
	loaded_rows: number | null;
	error_rows: number | null;
	created_at: string;
	rollback_at: string | null;
}

export const UPLOAD_LOG_STATUS = {
	IN_PROGRESS: 'IN_PROGRESS',
	COMPLETED: 'COMPLETED',
	FAILED: 'FAILED',
	ROLLED_BACK: 'ROLLED_BACK',
} as const;

@Injectable()
export class UploadLogService extends BaseService<UploadLogRepository> {
	constructor(
		protected readonly repository: UploadLogRepository,
		private readonly dataSource: DataSource,
	) {
		super(repository);
	}

	// Crea el registro de carga (réplica de Usp_InsertLogCarga). Debe ejecutarse dentro de la
	// transacción de la carga: el manager garantiza atomicidad con los INSERT de datos.
	async start(dto: CreateUploadLogDto, manager?: EntityManager) {
		return await this.repository.create({ ...dto, status: UPLOAD_LOG_STATUS.IN_PROGRESS }, manager);
	}

	async complete(id: number, totals: { total_rows: number; loaded_rows: number; error_rows: number }, manager?: EntityManager) {
		return await this.repository.update(id, { status: UPLOAD_LOG_STATUS.COMPLETED, ...totals }, manager);
	}

	async markRolledBack(id: number, manager?: EntityManager) {
		return await this.repository.markRolledBack(id, manager);
	}

	// Vista 4.3 — historial cronológico con filtros opcionales (raw SQL, on-pattern §15.2).
	async listLogs(filters: ListUploadLogsFilters): Promise<UploadLogListItem[]> {
		const where: string[] = [];
		const params: (string | number)[] = [];
		if (filters.uploadType) {
			params.push(filters.uploadType);
			where.push(`upload_type = $${params.length}`);
		}
		if (filters.status) {
			params.push(filters.status);
			where.push(`status = $${params.length}`);
		}
		if (filters.academicPeriodId !== undefined) {
			params.push(filters.academicPeriodId);
			where.push(`academic_period_id = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
		params.push(filters.limit, filters.offset);

		return await this.dataSource.query(
			`SELECT id, upload_type, status, academic_period_id, user_id, source_file,
			        total_rows, loaded_rows, error_rows,
			        created_at::text, rollback_at::text
			 FROM audit.upload_logs
			 ${whereSql}
			 ORDER BY created_at DESC
			 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			params,
		);
	}

	async findLog(id: number): Promise<UploadLogListItem> {
		const rows: UploadLogListItem[] = await this.dataSource.query(
			`SELECT id, upload_type, status, academic_period_id, user_id, source_file,
			        total_rows, loaded_rows, error_rows,
			        created_at::text, rollback_at::text
			 FROM audit.upload_logs
			 WHERE id = $1`,
			[id],
		);
		if (rows.length === 0) {
			throw new HttpException({ message: 'Upload log no encontrado', errors: [`id=${id}`] }, HttpStatus.NOT_FOUND);
		}
		return rows[0];
	}
}
