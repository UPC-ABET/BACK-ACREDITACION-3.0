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
	CreateProfessorMaintenanceDto,
	ProfessorMaintenanceItem,
	ProfessorLookupQueryDto,
	ProfessorLookupItem,
} from '../model/professors.dtos';
import { EntityManager } from 'typeorm';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';

@Injectable()
export class ProfessorService extends BaseService<ProfessorRepository> {
	constructor(protected readonly repository: ProfessorRepository) {
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
		return await this.repository.getByFilters(filters);
	}

	async getByUserId(userId: number) {
		return await this.repository.getByUserId(userId);
	}

	async getLookup(query: ProfessorLookupQueryDto): Promise<PaginatedResult<ProfessorLookupItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [professors, total] = await this.repository.findLookupPage(
			query.search,
			query.unassigned === true,
			skip,
			take,
		);

		const items = professors.map((professor) => ({
			id: professor.id,
			staffId: professor.staffId,
			code: professor.code ?? null,
			firstName: professor.staff.firstName,
			lastName: professor.staff.lastName,
			staffEmail: professor.staff.staffEmail ?? null,
			user: professor.staff.user
				? {
						id: professor.staff.user.id,
						firstName: professor.staff.user.firstName,
						lastName: professor.staff.user.lastName,
						email: professor.staff.user.email,
					}
				: null,
		}));

		return toPaginated(items, total, page, pageSize);
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
			staffEmail: professor.staff.staffEmail ?? null,
		}));

		return toPaginated(items, total, page, pageSize);
	}

	async createMaintenance(dto: CreateProfessorMaintenanceDto) {
		await ProfessorValidation.validateMaintenanceCreate(this.repository, dto);
		const id = await this.repository.createWithStaff(dto);
		return await this.getMaintenanceItem(id);
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
			staffEmail: professor.staff.staffEmail ?? null,
		};
	}
}
