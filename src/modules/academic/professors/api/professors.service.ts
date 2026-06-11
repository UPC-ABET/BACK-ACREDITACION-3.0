import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProfessorRepository } from '../core/professors.repository';
import { ProfessorValidation } from '../core/professors.validation';

import {
	CreateProfessorDto,
	UpdateProfessorDto,
	FilterProfessorDto,
} from '../model/professors.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { ProfessorEntity } from '../model/professors.entity';

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

		// Apply exact match filters (staff_id, is_active, extra)
		if (otherFilters.staffId !== undefined) {
			qb.andWhere('professor.staff_id = :staffId', { staffId: otherFilters.staffId });
		}

		if (otherFilters.isActive !== undefined) {
			qb.andWhere('professor.is_active = :isActive', { isActive: otherFilters.isActive });
		}

		if (otherFilters.extra !== undefined) {
			qb.andWhere('professor.extra = :extra', { extra: otherFilters.extra });
		}

		// Apply search filter (name search across first_name and last_name)
		if (search && search.trim()) {
			const searchTerm = `%${search.trim()}%`;
			qb.andWhere('(user.first_name ILIKE :searchTerm OR user.last_name ILIKE :searchTerm)', {
				searchTerm,
			});
		}

		return await qb.getMany();
	}

	async getByUserId(userId: number) {
		return await this.repository.getByUserId(userId);
	}
}
