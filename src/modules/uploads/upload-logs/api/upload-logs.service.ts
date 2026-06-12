import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EntityManager, QueryFailedError } from 'typeorm';
import type { I18nText } from 'src/shared/types/i18n';
import { UploadLogRepository } from '../core/upload-logs.repository';
import { UploadLogEntity } from '../model/upload-logs.entity';
import { CreateUploadLogDto, ListUploadLogsQueryDto } from '../model/upload-logs.dtos';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { ROLLBACK_RAISE_MAP } from '../model/upload-logs.constants';
import { uploadLogsValidationStrings } from '../config/strings/upload-logs.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

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
		const uploadTypeId = await this.resolveTypeId(dto.upload_type);
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

	// Translate a PostgreSQL RAISE from a rollback function (short code, SQLSTATE P0001) into the
	// matching frontend HTTP error. Any other DB error is rethrown unchanged (→ generic 500).
	rethrowRollbackError(error: unknown): never {
		if (error instanceof QueryFailedError) {
			const driverError = error.driverError as { code?: string; message?: string } | undefined;
			const raised = driverError?.code === 'P0001' ? driverError.message?.trim() : undefined;
			const mapped = raised ? ROLLBACK_RAISE_MAP[raised] : undefined;
			if (mapped) {
				throw new HttpException({ message: mapped.key, errors: [] }, mapped.status);
			}
		}
		throw error;
	}

	async assertAcademicPeriodExists(id: number): Promise<void> {
		if (!(await this.repository.academicPeriodExists(id))) {
			throw new HttpException(
				{ message: uploadLogsValidationStrings.error.periodNotFound, errors: [`id=${id}`] },
				HttpStatus.NOT_FOUND,
			);
		}
	}

	async assertRollbackable(id: number): Promise<void> {
		const log = await this.repository.findOneById(id, ['statusType']);
		if (!log) {
			throw new HttpException(
				{ message: uploadLogsValidationStrings.error.uploadLogNotFound, errors: [`id=${id}`] },
				HttpStatus.NOT_FOUND,
			);
		}
		if (log.statusType?.code === TYPE_CODES.UPLOAD_STATUS.ROLLBACK) {
			throw new HttpException(
				{ message: uploadLogsValidationStrings.error.rollbackAlreadyDone, errors: [`id=${id}`] },
				HttpStatus.CONFLICT,
			);
		}
	}

	async listLogs(
		query: ListUploadLogsQueryDto,
		academicPeriodId: number,
	): Promise<PaginatedResult<UploadLogItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [logs, total] = await this.repository.findLogs({
			uploadTypeCode: query.uploadTypeCode,
			statusCode: query.statusCode,
			academicPeriodId,
			skip,
			take,
		});
		return toPaginated(
			logs.map((log) => this.toItem(log)),
			total,
			page,
			pageSize,
		);
	}

	async findLog(id: number): Promise<UploadLogItem> {
		const log = await this.repository.findLogById(id);
		if (!log) {
			throw new HttpException(
				{ message: uploadLogsValidationStrings.error.uploadLogNotFound, errors: [`id=${id}`] },
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
				{ message: uploadLogsValidationStrings.error.typeCodeNotFound, errors: [`code=${code}`] },
				HttpStatus.BAD_REQUEST,
			);
		}
		return id;
	}
}
