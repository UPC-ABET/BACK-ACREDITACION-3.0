import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProgramCommissionRepository } from '../core/program-commissions.repository';
import { ProgramCommissionValidation } from '../core/program-commissions.validation';
import { OutcomeRepository } from 'src/modules/accreditation/outcomes/core/outcomes.repository';

import {
	CreateProgramCommissionDto,
	UpdateProgramCommissionDto,
	FilterProgramCommissionDetailedDto,
} from '../model/program-commissions.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ProgramCommissionService extends BaseService<ProgramCommissionRepository> {
	constructor(
		protected readonly repository: ProgramCommissionRepository,
		protected readonly dataSource: DataSource,
		private readonly outcomeRepository: OutcomeRepository,
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

	async associate(dto: CreateProgramCommissionDto) {
		await ProgramCommissionValidation.validateCreate(this.repository, dto);
		return await super.create(dto);
	}

	async unassociate(id: number) {
		await ProgramCommissionValidation.validateUnassociate(
			this.repository,
			this.outcomeRepository,
			id,
		);
		return await super.delete(id);
	}

	async listByPeriod(academicPeriodId: number) {
		return await super.getByFilters({ academicPeriodId });
	}

	async getCommissionOptions(academicPeriodId: number, accreditorId?: number, programId?: number) {
		return await this.repository.getCommissionOptions(academicPeriodId, accreditorId, programId);
	}

	async getProgramOptions(academicPeriodId: number, commissionId?: number) {
		return await this.repository.getProgramOptions(academicPeriodId, commissionId);
	}

	async getDetailedByFilters(
		academicPeriodId: number,
		filters: FilterProgramCommissionDetailedDto,
	) {
		return await this.repository.getDetailedByFilters(academicPeriodId, filters);
	}
}
