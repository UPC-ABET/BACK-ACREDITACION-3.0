import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EntityManager } from 'typeorm';
import type { I18nText } from 'src/shared/types/i18n';
import { UploadLogRepository } from '../core/upload-logs.repository';
import { UploadLogEntity } from '../model/upload-logs.entity';
import { CreateUploadLogDto } from '../model/upload-logs.dtos';
import { LEGACY_UPLOAD_TYPE_CODES } from '../model/upload-logs.constants';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

export interface ListUploadLogsFilters {
	uploadTypeCode?: string;
	statusCode?: string;
	academicPeriodId?: number;
	limit: number;
	offset: number;
}

export interface UploadTypeRef {
	code: string;
	name: I18nText;
}

export interface UploadLogUserRef {
	id: number;
	fullName: string;
	email: string;
}

export interface UploadLogItem {
	id: number;
	uploadType: UploadTypeRef;
	status: UploadTypeRef;
	academicPeriodId: number | null;
	user: UploadLogUserRef;
	sourceFile: string | null;
	totalRows: number | null;
	loadedRows: number | null;
	errorRows: number | null;
	createdAt: Date;
	rollbackAt: Date | null;
}

@Injectable()
export class UploadLogService extends BaseService<UploadLogRepository> {
	constructor(protected readonly repository: UploadLogRepository) {
		super(repository);
	}

	async start(dto: CreateUploadLogDto, manager?: EntityManager) {
		const uploadTypeId = await this.resolveTypeId(LEGACY_UPLOAD_TYPE_CODES[dto.upload_type] ?? dto.upload_type);
		const statusTypeId = await this.resolveTypeId(TYPE_CODES.UPLOAD_STATUS.COMPLETED);
		return await this.repository.create(
			{
				uploadTypeId,
				statusTypeId,
				academicPeriodId: dto.academic_period_id,
				userId: dto.user_id,
				sourceFile: dto.source_file,
				totalRows: dto.total_rows,
				loadedRows: dto.loaded_rows,
				errorRows: dto.error_rows,
			},
			manager,
		);
	}

	async complete(
		id: number,
		totals: { total_rows: number; loaded_rows: number; error_rows: number },
		manager?: EntityManager,
	) {
		const statusTypeId = await this.resolveTypeId(TYPE_CODES.UPLOAD_STATUS.COMPLETED);
		return await this.repository.update(
			id,
			{
				statusTypeId,
				totalRows: totals.total_rows,
				loadedRows: totals.loaded_rows,
				errorRows: totals.error_rows,
			},
			manager,
		);
	}

	async markRolledBack(id: number, manager?: EntityManager) {
		const statusTypeId = await this.resolveTypeId(TYPE_CODES.UPLOAD_STATUS.ROLLBACK);
		return await this.repository.markRolledBack(id, statusTypeId, manager);
	}

	async assertRollbackable(id: number): Promise<void> {
		const log = await this.repository.findOneById(id, ['statusType']);
		if (!log) {
			throw new HttpException(
				{ message: 'uploads.common.error.uploadLogNotFound', errors: [`id=${id}`] },
				HttpStatus.NOT_FOUND,
			);
		}
		if (log.statusType?.code === TYPE_CODES.UPLOAD_STATUS.ROLLBACK) {
			throw new HttpException(
				{ message: 'uploads.common.error.rollbackAlreadyDone', errors: [`id=${id}`] },
				HttpStatus.CONFLICT,
			);
		}
	}

	async listLogs(filters: ListUploadLogsFilters): Promise<UploadLogItem[]> {
		const logs = await this.repository.findLogs(filters);
		return logs.map((log) => this.toItem(log));
	}

	async findLog(id: number): Promise<UploadLogItem> {
		const log = await this.repository.findLogById(id);
		if (!log) {
			throw new HttpException(
				{ message: 'uploads.common.error.uploadLogNotFound', errors: [`id=${id}`] },
				HttpStatus.NOT_FOUND,
			);
		}
		return this.toItem(log);
	}

	private toItem(log: UploadLogEntity): UploadLogItem {
		return {
			id: log.id,
			uploadType: { code: log.uploadType.code, name: log.uploadType.name },
			status: { code: log.statusType.code, name: log.statusType.name },
			academicPeriodId: log.academicPeriodId,
			user: {
				id: log.user.id,
				fullName: `${log.user.firstName} ${log.user.lastName}`.trim(),
				email: log.user.email,
			},
			sourceFile: log.sourceFile,
			totalRows: log.totalRows,
			loadedRows: log.loadedRows,
			errorRows: log.errorRows,
			createdAt: log.createdAt,
			rollbackAt: log.rollbackAt,
		};
	}

	private async resolveTypeId(code: string): Promise<number> {
		const id = await this.repository.findTypeIdByCode(code);
		if (id === null) {
			throw new HttpException(
				{ message: 'uploads.common.error.typeCodeNotFound', errors: [`code=${code}`] },
				HttpStatus.BAD_REQUEST,
			);
		}
		return id;
	}
}
