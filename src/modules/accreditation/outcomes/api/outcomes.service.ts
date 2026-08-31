import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { OutcomeRepository } from '../core/outcomes.repository';
import { OutcomeValidation } from '../core/outcomes.validation';

import {
	CreateOutcomeDto,
	UpdateOutcomeDto,
	OutcomeMaintenanceQueryDto,
	UpdateOutcomeMaintenanceDto,
	CreateOutcomeMaintenanceDto,
	OutcomeMaintenanceItem,
} from '../model/outcomes.dtos';
import { EntityManager } from 'typeorm';
import { OutcomeEntity } from '../model/outcomes.entity';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';

@Injectable()
export class OutcomeService extends BaseService<OutcomeRepository> {
	constructor(protected readonly repository: OutcomeRepository) {
		super(repository);
	}

	async create(dto: CreateOutcomeDto, manager?: EntityManager) {
		await OutcomeValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateOutcomeDto, manager?: EntityManager) {
		await OutcomeValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await OutcomeValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getById(id: number) {
		return await this.repository.findByIdWithCommission(id);
	}

	async getMaintenanceList(
		query: OutcomeMaintenanceQueryDto,
		academicPeriodId: number,
	): Promise<PaginatedResult<OutcomeMaintenanceItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [outcomes, total] = await this.repository.findMaintenancePage(
			query.programId,
			academicPeriodId,
			query.commissionId ?? null,
			query.search,
			skip,
			take,
		);

		return toPaginated(
			outcomes.map((outcome) => this.toMaintenanceItem(outcome)),
			total,
			page,
			pageSize,
		);
	}

	async createMaintenance(academicPeriodId: number, dto: CreateOutcomeMaintenanceDto) {
		const programCommissionId = await this.repository.findProgramCommissionId(
			dto.programId,
			dto.commissionId,
			academicPeriodId,
		);
		await OutcomeValidation.validateMaintenanceCreate(this.repository, programCommissionId, dto);

		const created = await this.repository.create({
			programCommissionId: programCommissionId as number,
			outcomeCode: dto.outcomeCode,
			outcomeName: dto.outcomeName,
			outcomeDescription: dto.outcomeDescription ?? {},
		});
		return await this.getMaintenanceItem(created.id);
	}

	async updateMaintenance(id: number, dto: UpdateOutcomeMaintenanceDto) {
		await OutcomeValidation.validateMaintenanceUpdate(this.repository, id, dto);
		await this.repository.update(id, dto);
		return await this.getMaintenanceItem(id);
	}

	async deleteMaintenance(id: number) {
		await OutcomeValidation.validateMaintenanceDelete(this.repository, id);
		await this.repository.remove(id);
		return { id };
	}

	private async getMaintenanceItem(id: number): Promise<OutcomeMaintenanceItem | null> {
		const outcome = await this.repository.findByIdWithCommission(id);
		return outcome ? this.toMaintenanceItem(outcome) : null;
	}

	private toMaintenanceItem(outcome: OutcomeEntity): OutcomeMaintenanceItem {
		return {
			id: outcome.id,
			commissionCode: outcome.programCommission.commission.code,
			outcomeCode: outcome.outcomeCode,
			outcomeName: outcome.outcomeName,
			outcomeDescription: outcome.outcomeDescription,
		};
	}
}
