import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StaffRepository } from '../core/staff.repository';
import { StaffValidation } from '../core/staff.validation';

import { CreateStaffDto, UpdateStaffDto, StaffLookupItem } from '../model/staff.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { LookupQueryDto } from 'src/commons/lookup.dtos';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';

@Injectable()
export class StaffService extends BaseService<StaffRepository> {
	constructor(
		protected readonly repository: StaffRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateStaffDto, manager?: EntityManager) {
		await StaffValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStaffDto, manager?: EntityManager) {
		await StaffValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StaffValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getLookup(query: LookupQueryDto): Promise<PaginatedResult<StaffLookupItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [rows, total] = await this.repository.findLookupPage(query.search, skip, take);
		const items: StaffLookupItem[] = rows.map((row) => ({
			id: row.id,
			professorCode: row.professorCode,
			firstName: row.firstName,
			lastName: row.lastName,
			jobTitle: row.jobTitle,
			label: row.professorCode
				? `${row.professorCode} - ${row.firstName} ${row.lastName}`
				: `${row.firstName} ${row.lastName}`,
		}));
		return toPaginated(items, total, page, pageSize);
	}
}
