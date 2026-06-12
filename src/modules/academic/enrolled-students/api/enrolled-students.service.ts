import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EnrolledStudentRepository } from '../core/enrolled-students.repository';
import { EnrolledStudentValidation } from '../core/enrolled-students.validation';

import {
	CreateEnrolledStudentDto,
	UpdateEnrolledStudentDto,
	EnrolledStudentMaintenanceQueryDto,
	UpdateEnrolledStudentMaintenanceDto,
	EnrolledStudentMaintenanceItem,
} from '../model/enrolled-students.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { EnrolledStudentEntity } from '../model/enrolled-students.entity';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';

@Injectable()
export class EnrolledStudentService extends BaseService<EnrolledStudentRepository> {
	constructor(
		protected readonly repository: EnrolledStudentRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateEnrolledStudentDto, manager?: EntityManager) {
		await EnrolledStudentValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateEnrolledStudentDto, manager?: EntityManager) {
		await EnrolledStudentValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await EnrolledStudentValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getMaintenanceList(
		academicPeriodId: number,
		query: EnrolledStudentMaintenanceQueryDto,
	): Promise<PaginatedResult<EnrolledStudentMaintenanceItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [rows, total] = await this.repository.findMaintenancePage(
			academicPeriodId,
			query.search,
			skip,
			take,
		);

		return toPaginated(
			rows.map((row) => this.toMaintenanceItem(row)),
			total,
			page,
			pageSize,
		);
	}

	async updateMaintenance(id: number, dto: UpdateEnrolledStudentMaintenanceDto) {
		await EnrolledStudentValidation.validateMaintenanceUpdate(this.repository, id, dto);
		await this.repository.updateMaintenance(id, dto);
		return await this.getMaintenanceItem(id);
	}

	async deleteMaintenance(id: number) {
		await EnrolledStudentValidation.validateMaintenanceDelete(this.repository, id);
		await this.repository.remove(id);
		return { id };
	}

	private async getMaintenanceItem(id: number): Promise<EnrolledStudentMaintenanceItem | null> {
		const row = await this.repository.findByIdWithRelations(id);
		return row ? this.toMaintenanceItem(row) : null;
	}

	private toMaintenanceItem(entity: EnrolledStudentEntity): EnrolledStudentMaintenanceItem {
		return {
			id: entity.id,
			studentCode: entity.student.code,
			firstName: entity.student.firstName,
			lastName: entity.student.lastName,
			campusName: entity.campus.name,
			programName: entity.student.program.name,
			modalityTypeName: entity.enrollementModalityType.name,
		};
	}
}
