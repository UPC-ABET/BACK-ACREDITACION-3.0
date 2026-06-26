import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { ArdValidation } from '../core/ards.validation';
import { ArdRepository, ArdDetail } from '../core/ards.repository';
import {
	ArdAttendeesQueryDto,
	ArdAttendeesResult,
	ArdMaintenanceItem,
	ArdMaintenanceQueryDto,
	ArdProgramCourse,
	ArdProgramCoursesQueryDto,
	CreateArdDto,
	UpdateArdDto,
} from '../model/ards.dtos';
import { ardsValidationStrings } from '../config/strings/ards.validation';
import { NotFoundError } from 'src/commons/domain-error';

@Injectable()
export class ArdService extends BaseService<ArdRepository> {
	constructor(protected readonly repository: ArdRepository) {
		super(repository);
	}

	async getMaintenanceList(
		academicPeriodId: number,
		query: ArdMaintenanceQueryDto,
	): Promise<PaginatedResult<ArdMaintenanceItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [items, total] = await this.repository.findMaintenancePage(
			academicPeriodId,
			{
				campusId: query.campusId,
				dateFrom: query.dateFrom,
				dateTo: query.dateTo,
				search: query.search,
			},
			skip,
			take,
		);
		return toPaginated(items, total, page, pageSize);
	}

	async getAttendees(
		academicPeriodId: number,
		query: ArdAttendeesQueryDto,
	): Promise<ArdAttendeesResult> {
		return await this.repository.findDelegatesAndGuests(
			academicPeriodId,
			query.campusId,
			query.programId,
		);
	}

	async getProgramCourses(
		academicPeriodId: number,
		query: ArdProgramCoursesQueryDto,
	): Promise<ArdProgramCourse[]> {
		return await this.repository.findProgramCourses(
			academicPeriodId,
			query.programId,
			query.campusId,
		);
	}

	async getDetail(id: number): Promise<ArdDetail> {
		const detail = await this.repository.findDetail(id);
		if (!detail) {
			throw new NotFoundError(ardsValidationStrings.error.notFound);
		}
		return detail;
	}

	async createArd(
		academicPeriodId: number,
		schoolId: number,
		dto: CreateArdDto,
	): Promise<ArdDetail> {
		await ArdValidation.validateCreate(this.repository, academicPeriodId, dto);
		const id = await this.repository.createFull(dto, academicPeriodId, schoolId);
		return await this.getDetail(id);
	}

	async updateArd(
		id: number,
		academicPeriodId: number,
		schoolId: number,
		dto: UpdateArdDto,
	): Promise<ArdDetail> {
		await ArdValidation.validateUpdate(this.repository, id, academicPeriodId, dto);
		await this.repository.updateFull(id, dto, academicPeriodId, schoolId);
		return await this.getDetail(id);
	}

	async delete(id: number): Promise<{ id: number }> {
		await ArdValidation.validateDelete(this.repository, id);
		await this.repository.softDelete(id);
		return { id };
	}
}
