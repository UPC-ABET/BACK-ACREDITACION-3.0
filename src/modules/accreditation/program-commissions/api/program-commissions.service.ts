import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProgramCommissionRepository } from '../core/program-commissions.repository';
import { ProgramCommissionValidation } from '../core/program-commissions.validation';

import { CreateProgramCommissionDto, UpdateProgramCommissionDto } from '../model/program-commissions.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ProgramCommissionService extends BaseService<ProgramCommissionRepository> {
	constructor(
		protected readonly repository: ProgramCommissionRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateProgramCommissionDto, manager?: EntityManager) {
		await ProgramCommissionValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateProgramCommissionDto, manager?: EntityManager) {
		await ProgramCommissionValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ProgramCommissionValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
