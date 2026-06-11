import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { UploadLogEntity } from '../model/upload-logs.entity';

export interface FindLogsOptions {
	uploadTypeCode?: string;
	statusCode?: string;
	academicPeriodId?: number;
	limit: number;
	offset: number;
}

export class UploadLogRepository extends BaseRepository<UploadLogEntity> {
	constructor(
		@InjectRepository(UploadLogEntity)
		repository: Repository<UploadLogEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async markRolledBack(id: number, statusTypeId: number, manager?: EntityManager) {
		return await this.update(id, { statusTypeId, rollbackAt: new Date() }, manager);
	}

	async findLogs(options: FindLogsOptions): Promise<UploadLogEntity[]> {
		const qb = this.baseQuery();
		if (options.uploadTypeCode) {
			qb.andWhere('uploadType.code = :uploadTypeCode', { uploadTypeCode: options.uploadTypeCode });
		}
		if (options.statusCode) {
			qb.andWhere('statusType.code = :statusCode', { statusCode: options.statusCode });
		}
		if (options.academicPeriodId !== undefined) {
			qb.andWhere('log.academicPeriodId = :academicPeriodId', {
				academicPeriodId: options.academicPeriodId,
			});
		}
		return await qb
			.orderBy('log.createdAt', 'DESC')
			.limit(options.limit)
			.offset(options.offset)
			.getMany();
	}

	async findLogById(id: number): Promise<UploadLogEntity | null> {
		return await this.baseQuery().andWhere('log.id = :id', { id }).getOne();
	}

	async academicPeriodExists(id: number): Promise<boolean> {
		const row = await this.dataSource
			.createQueryBuilder()
			.select('1', 'one')
			.from('academic.academic_periods', 'ap')
			.where('ap.id = :id', { id })
			.limit(1)
			.getRawOne<{ one: number }>();
		return row !== undefined && row !== null;
	}

	async findTypeIdByCode(code: string): Promise<number | null> {
		const type = await this.dataSource
			.createQueryBuilder()
			.select('t.id', 'id')
			.from('core.types', 't')
			.where('t.code = :code', { code })
			.limit(1)
			.getRawOne<{ id: number }>();
		return type?.id ?? null;
	}

	private baseQuery() {
		return this.dataSource
			.createQueryBuilder(UploadLogEntity, 'log')
			.leftJoinAndSelect('log.uploadType', 'uploadType')
			.leftJoinAndSelect('log.statusType', 'statusType')
			.leftJoinAndSelect('log.user', 'user');
	}
}
