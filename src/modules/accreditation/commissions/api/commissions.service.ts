import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { CommissionRepository } from '../core/commissions.repository';
import { CommissionValidation } from '../core/commissions.validation';

import { CreateCommissionDto, UpdateCommissionDto } from '../model/commissions.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class CommissionService extends BaseService<CommissionRepository> {
	constructor(protected readonly repository: CommissionRepository) {
		super(repository);
	}

	async create(dto: CreateCommissionDto, manager?: EntityManager) {
		await CommissionValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateCommissionDto, manager?: EntityManager) {
		await CommissionValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await CommissionValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
