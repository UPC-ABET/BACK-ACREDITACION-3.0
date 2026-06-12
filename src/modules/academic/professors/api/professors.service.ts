import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProfessorRepository } from '../core/professors.repository';
import { ProfessorValidation } from '../core/professors.validation';

import {
	CreateProfessorDto,
	UpdateProfessorDto,
	FilterProfessorDto,
	ProfessorMaintenanceQueryDto,
	UpdateProfessorMaintenanceDto,
	ProfessorMaintenanceItem,
} from '../model/professors.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { ProfessorEntity } from '../model/professors.entity';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';

@Injectable()
export class ProfessorService extends BaseService<ProfessorRepository> {
	constructor(
		protected readonly repository: ProfessorRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateProfessorDto, manager?: EntityManager) {
		await ProfessorValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateProfessorDto, manager?: EntityManager) {
		await ProfessorValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ProfessorValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getByFilters(filters: FilterProfessorDto) {
		const { search, ...otherFilters } = filters;

		const qb = this.dataSource
			.getRepository(ProfessorEntity)
			.createQueryBuilder('professor')
			.leftJoinAndSelect('professor.staff', 'staff')
			.leftJoinAndSelect('staff.user', 'user');

		if (otherFilters.staffId !== undefined) {
			qb.andWhere('professor.staff_id = :staffId', { staffId: otherFilters.staffId });
		}

		if (otherFilters.isActive !== undefined) {
			qb.andWhere('professor.is_active = :isActive', { isActive: otherFilters.isActive });
		}

		if (otherFilters.extra !== undefined) {
			qb.andWhere('professor.extra = :extra', { extra: otherFilters.extra });
		}

		if (otherFilters.unassigned === true) {
			qb.andWhere('staff.user_id IS NULL');
		}

		if (search && search.trim()) {
			const searchTerm = `%${search.trim()}%`;
			qb.andWhere(
				'(professor.code ILIKE :searchTerm OR staff.first_name ILIKE :searchTerm OR staff.last_name ILIKE :searchTerm)',
				{ searchTerm },
			);
		}

		return await qb.getMany();
	}

	async getByUserId(userId: number) {
		return await this.repository.getByUserId(userId);
	}

	async getMaintenanceList(
		query: ProfessorMaintenanceQueryDto,
	): Promise<PaginatedResult<ProfessorMaintenanceItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [professors, total] = await this.repository.findMaintenancePage(query.search, skip, take);

		const items = professors.map((professor) => ({
			id: professor.id,
			staffId: professor.staffId,
			code: professor.code,
			firstName: professor.staff.firstName,
			lastName: professor.staff.lastName,
		}));

		return toPaginated(items, total, page, pageSize);
	}

	async updateMaintenance(id: number, dto: UpdateProfessorMaintenanceDto) {
		await ProfessorValidation.validateMaintenanceUpdate(this.repository, id, dto);
		await this.repository.updateMaintenance(id, dto);
		return await this.getMaintenanceItem(id);
	}

	async deleteMaintenance(id: number) {
		await ProfessorValidation.validateMaintenanceDelete(this.repository, id);
		await this.repository.deleteWithStaff(id);
		return { id };
	}

	private async getMaintenanceItem(id: number): Promise<ProfessorMaintenanceItem | null> {
		const professor = await this.repository.findOneById(id, ['staff']);
		if (!professor) return null;
		return {
			id: professor.id,
			staffId: professor.staffId,
			code: professor.code,
			firstName: professor.staff.firstName,
			lastName: professor.staff.lastName,
		};
	}
}
