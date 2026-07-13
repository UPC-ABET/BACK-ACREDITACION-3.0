import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { extractFormulaReferences } from 'src/libs/formula.functions';
import { OutcomeRepository } from 'src/modules/accreditation/outcomes/core/outcomes.repository';
import { ProgramCommissionRepository } from 'src/modules/accreditation/program-commissions/core/program-commissions.repository';
import { OutcomeConversionsRepository } from '../core/outcome-conversions.repository';
import { OutcomeConversionValidation } from '../core/outcome-conversions.validation';
import {
	CreateOutcomeConversionDto,
	FilterOutcomeConversionDto,
	OutcomeConversionCoverageDto,
	OutcomeConversionDto,
	UpdateOutcomeConversionDto,
} from '../model/outcome-conversions.dtos';
import { outcomeConversionsValidationStrings } from '../config/strings/outcome-conversions.validation';

@Injectable()
export class OutcomeConversionsService extends BaseService<OutcomeConversionsRepository> {
	constructor(
		private readonly conversionsRepository: OutcomeConversionsRepository,
		private readonly programCommissionRepository: ProgramCommissionRepository,
		private readonly outcomeRepository: OutcomeRepository,
	) {
		super(conversionsRepository);
	}

	async getByFiltersDetailed(
		filters: FilterOutcomeConversionDto,
		academicPeriodId: number,
	): Promise<OutcomeConversionDto[]> {
		const rows = await this.conversionsRepository.list(
			filters.sourceProgramCommissionId ?? null,
			filters.targetProgramCommissionId ?? null,
			filters.academicPeriodId ?? academicPeriodId,
		);

		return rows.map((row) => ({
			...row,
			referencedOutcomeCodes: extractFormulaReferences(row.formula),
		}));
	}

	async getCoverage(academicPeriodId: number): Promise<OutcomeConversionCoverageDto[]> {
		return this.conversionsRepository.getCoverage(academicPeriodId);
	}

	async createConversion(dto: CreateOutcomeConversionDto) {
		await OutcomeConversionValidation.validateUpsert(
			this.conversionsRepository,
			this.programCommissionRepository,
			this.outcomeRepository,
			dto,
		);
		return await super.create(dto);
	}

	async updateConversion(id: number, dto: UpdateOutcomeConversionDto) {
		const current = await this.conversionsRepository.findOneById(id);
		if (!current) {
			throw new NotFoundException(outcomeConversionsValidationStrings.error.notFound);
		}

		await OutcomeConversionValidation.validateUpsert(
			this.conversionsRepository,
			this.programCommissionRepository,
			this.outcomeRepository,
			{
				sourceProgramCommissionId:
					dto.sourceProgramCommissionId ?? current.sourceProgramCommissionId,
				targetProgramCommissionId:
					dto.targetProgramCommissionId ?? current.targetProgramCommissionId,
				targetOutcomeId: dto.targetOutcomeId ?? current.targetOutcomeId,
				formula: dto.formula ?? current.formula,
			},
			id,
		);

		return await super.update(id, dto);
	}
}
