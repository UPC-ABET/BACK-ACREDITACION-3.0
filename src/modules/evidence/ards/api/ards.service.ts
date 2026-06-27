import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { NotFoundError } from 'src/commons/domain-error';
import { ArdValidation } from '../core/ards.validation';
import { ArdRepository } from '../core/ards.repository';
import {
	ArdClassRepresentative,
	ArdClassRepresentativesQueryDto,
	ArdCourseProfessor,
	ArdCourseProfessorsQueryDto,
	ArdMaintenanceItem,
	ArdMaintenanceQueryDto,
	ArdProgramCourse,
	ArdProgramCoursesQueryDto,
	ArdView,
	CreateArdDetailsDto,
	CreateArdDto,
	UpdateArdDto,
} from '../model/ards.dtos';
import { ardsValidationStrings } from '../config/strings/ards.validation';

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
				programId: query.programId,
				meetingDate: query.meetingDate,
				search: query.search,
			},
			skip,
			take,
		);
		return toPaginated(items, total, page, pageSize);
	}

	async getView(id: number): Promise<ArdView> {
		const view = await this.repository.findView(id);
		if (!view) {
			throw new NotFoundError(ardsValidationStrings.error.notFound);
		}
		return view;
	}

	async createArd(academicPeriodId: number, dto: CreateArdDto): Promise<ArdView> {
		await ArdValidation.validateCreate(this.repository, academicPeriodId, dto);
		const id = await this.repository.createArd(dto, academicPeriodId);
		return await this.getView(id);
	}

	async updateArd(id: number, dto: UpdateArdDto): Promise<ArdView> {
		await ArdValidation.validateUpdate(this.repository, id, dto);
		await this.repository.updateArd(id, dto);
		return await this.getView(id);
	}

	async saveDetails(dto: CreateArdDetailsDto): Promise<ArdView> {
		await ArdValidation.validateDetails(this.repository, dto);
		await this.repository.replaceDetails(dto.ardId, dto.details);
		return await this.getView(dto.ardId);
	}

	async delete(id: number): Promise<{ id: number }> {
		await ArdValidation.validateExists(this.repository, id);
		await this.repository.deleteWithDetails(id);
		return { id };
	}

	async getClassRepresentatives(
		academicPeriodId: number,
		query: ArdClassRepresentativesQueryDto,
	): Promise<ArdClassRepresentative[]> {
		return await this.repository.findClassRepresentatives(
			academicPeriodId,
			query.programId,
			query.campusId,
		);
	}

	async getProgramCourses(
		academicPeriodId: number,
		query: ArdProgramCoursesQueryDto,
	): Promise<ArdProgramCourse[]> {
		return await this.repository.findProgramCourses(academicPeriodId, query.programId);
	}

	async getCourseProfessors(
		academicPeriodId: number,
		query: ArdCourseProfessorsQueryDto,
	): Promise<ArdCourseProfessor[]> {
		return await this.repository.findCourseProfessors(
			academicPeriodId,
			query.courseId,
			query.campusId,
		);
	}
}
