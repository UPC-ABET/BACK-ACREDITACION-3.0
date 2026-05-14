import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StaffRepository } from '../core/staff.repository';
import { StaffValidation } from '../core/staff.validation';

import { CreateStaffDto, UpdateStaffDto } from '../model/staff.dtos';
import { DataSource, EntityManager } from 'typeorm';

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
}
