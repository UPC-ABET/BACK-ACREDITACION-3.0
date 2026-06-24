import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StudentSectionEnrollmentRepository } from '../core/student-section-enrollments.repository';
import { StudentSectionEnrollmentValidation } from '../core/student-section-enrollments.validation';

import {
	CreateStudentSectionEnrollmentDto,
	UpdateStudentSectionEnrollmentDto,
	StudentSectionEnrollmentMaintenanceQueryDto,
	UpdateStudentSectionEnrollmentMaintenanceDto,
	CreateStudentSectionEnrollmentMaintenanceDto,
	StudentSectionEnrollmentMaintenanceItem,
	toStudentSectionEnrollmentMaintenanceItem,
} from '../model/student-section-enrollments.dtos';
import { EntityManager } from 'typeorm';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';

@Injectable()
export class StudentSectionEnrollmentService extends BaseService<StudentSectionEnrollmentRepository> {
	constructor(protected readonly repository: StudentSectionEnrollmentRepository) {
		super(repository);
	}

	async create(dto: CreateStudentSectionEnrollmentDto, manager?: EntityManager) {
		await StudentSectionEnrollmentValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudentSectionEnrollmentDto, manager?: EntityManager) {
		await StudentSectionEnrollmentValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudentSectionEnrollmentValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getMaintenanceList(
		academicPeriodId: number,
		query: StudentSectionEnrollmentMaintenanceQueryDto,
		options?: { isClassRepresentative?: boolean },
	): Promise<PaginatedResult<StudentSectionEnrollmentMaintenanceItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [rows, total] = await this.repository.findMaintenancePage(
			academicPeriodId,
			query.programId,
			query.search,
			skip,
			take,
			options?.isClassRepresentative,
		);

		return toPaginated(rows.map(toStudentSectionEnrollmentMaintenanceItem), total, page, pageSize);
	}

	async createMaintenance(dto: CreateStudentSectionEnrollmentMaintenanceDto) {
		await StudentSectionEnrollmentValidation.validateMaintenanceCreate(this.repository, dto);
		const created = await this.repository.create({
			courseSectionId: dto.courseSectionId,
			enrolledStudentId: dto.enrolledStudentId,
		});
		return await this.getMaintenanceItem(created.id);
	}

	async updateMaintenance(id: number, dto: UpdateStudentSectionEnrollmentMaintenanceDto) {
		await StudentSectionEnrollmentValidation.validateMaintenanceUpdate(this.repository, id, dto);
		await this.repository.update(id, dto);
		return await this.getMaintenanceItem(id);
	}

	async deleteMaintenance(id: number) {
		await StudentSectionEnrollmentValidation.validateMaintenanceDelete(this.repository, id);
		await this.repository.remove(id);
		return { id };
	}

	private async getMaintenanceItem(
		id: number,
	): Promise<StudentSectionEnrollmentMaintenanceItem | null> {
		const row = await this.repository.findByIdWithRelations(id);
		return row ? toStudentSectionEnrollmentMaintenanceItem(row) : null;
	}
}
