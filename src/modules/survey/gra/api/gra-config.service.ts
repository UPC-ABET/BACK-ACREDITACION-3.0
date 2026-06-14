import { Injectable, NotFoundException } from '@nestjs/common';
import { GraConfigRepository, GRA_SURVEY_TYPE } from '../core/gra-config.repository';
import {
	CreateGraConfigDto,
	UpdateGraConfigDto,
	FilterGraConfigDto,
	ReplicateGraConfigDto,
	ListGraSurveyOutcomesDto,
} from '../model/gra.dtos';
import { PerformanceLevelService } from 'src/modules/academic/performance-levels/api/performance-levels.service';
import { camelizeKeys } from 'src/libs/case.functions';

@Injectable()
export class GraConfigService {
	constructor(
		private readonly configRepo: GraConfigRepository,
		private readonly acceptanceLevelService: PerformanceLevelService,
	) {}

	async create(dto: CreateGraConfigDto) {
		const extra = {
			survey_type: GRA_SURVEY_TYPE,
			name_en: dto.nameEn ?? null,
			description_en: dto.descriptionEn ?? null,
			order: dto.order ?? null,
			program_id: dto.programId ?? null,
			academic_period_id: dto.academicPeriodId ?? null,
			commission_id: dto.commissionId ?? null,
			is_visible: dto.isVisible ?? true,
		};

		return await this.configRepo.create({
			outcomeId: dto.outcomeId,
			userOutcomeName: dto.nameEs as any,
			userOutcomeDescription: (dto.descriptionEs ?? null) as any,
			extra,
			isActive: true,
		});
	}

	async getAll(filters?: FilterGraConfigDto) {
		const configs = await this.configRepo.findAllGra(filters);
		for (const config of configs) config.extra = camelizeKeys(config.extra);
		return configs;
	}

	async getById(id: number) {
		const config = await this.configRepo.findOneGra(id);
		if (!config) throw new NotFoundException(`GRA configuration with ID ${id} not found`);
		config.extra = camelizeKeys(config.extra);
		return config;
	}

	async update(id: number, dto: UpdateGraConfigDto) {
		const current = await this.configRepo.findOneGra(id);
		if (!current) throw new NotFoundException(`Configuración GRA con ID ${id} no encontrada`);

		const currentExtra = (current?.extra as Record<string, any>) ?? {};

		const extra = {
			...currentExtra,
			...(dto.nameEn !== undefined && { name_en: dto.nameEn }),
			...(dto.descriptionEn !== undefined && { description_en: dto.descriptionEn }),
			...(dto.order !== undefined && { order: dto.order }),
			...(dto.programId !== undefined && { program_id: dto.programId }),
			...(dto.academicPeriodId !== undefined && { academic_period_id: dto.academicPeriodId }),
			...(dto.commissionId !== undefined && { commission_id: dto.commissionId }),
			...(dto.isVisible !== undefined && { is_visible: dto.isVisible }),
		};

		const updatePayload: Record<string, any> = { extra };
		if (dto.outcomeId !== undefined) updatePayload.outcomeId = dto.outcomeId;
		if (dto.nameEs !== undefined) updatePayload.userOutcomeName = dto.nameEs;
		if (dto.descriptionEs !== undefined) updatePayload.userOutcomeDescription = dto.descriptionEs;
		if (dto.isActive !== undefined) updatePayload.isActive = dto.isActive;

		return await this.configRepo.update(id, updatePayload);
	}

	async delete(id: number) {
		const config = await this.configRepo.findOneGra(id);
		if (!config) throw new NotFoundException(`GRA configuration with ID ${id} not found`);
		return await this.configRepo.update(id, { isActive: false });
	}

	async replicate(dto: ReplicateGraConfigDto) {
		const sourceConfigs = await this.configRepo.findAllGra({
			academicPeriodId: dto.sourceAcademicPeriodId,
			...(dto.programId && { programId: dto.programId }),
			isActive: true,
		});

		if (sourceConfigs.length === 0) {
			return {
				replicatedConfigs: 0,
				replicatedLevels: 0,
				message: 'No configurations found in the source period',
			};
		}

		let replicatedConfigs = 0;
		for (const config of sourceConfigs) {
			const sourceExtra = (config.extra as Record<string, any>) ?? {};
			const alreadyExists = await this.configRepo.existsGra(
				config.outcomeId,
				sourceExtra.program_id,
				dto.targetAcademicPeriodId,
			);
			if (alreadyExists) continue;

			await this.configRepo.create({
				outcomeId: config.outcomeId,
				userOutcomeName: config.userOutcomeName,
				userOutcomeDescription: config.userOutcomeDescription,
				extra: { ...sourceExtra, academic_period_id: dto.targetAcademicPeriodId },
				isActive: true,
			});
			replicatedConfigs++;
		}

		const graTypeId = await this.configRepo.findSurveyTypeIdByCode(GRA_SURVEY_TYPE);
		let replicatedLevels = 0;
		if (graTypeId) {
			replicatedLevels = await this.acceptanceLevelService.copyFromPeriod({
				surveyTypeId: graTypeId,
				sourceAcademicPeriodId: dto.sourceAcademicPeriodId,
				targetAcademicPeriodId: dto.targetAcademicPeriodId,
			});
		}

		return {
			replicatedConfigs,
			totalSourceConfigs: sourceConfigs.length,
			replicatedLevels,
			message: `Replicated ${replicatedConfigs} GRA configurations and ${replicatedLevels} performance levels to the target period`,
		};
	}

	async listOutcomesForSurvey(dto: ListGraSurveyOutcomesDto) {
		const rows = await this.configRepo.findOutcomesGroupedByCommission(
			dto.programId,
			dto.academicPeriodId,
		);

		const grouped: Record<number, { commissionId: number; commissionName: any; outcomes: any[] }> =
			{};
		for (const row of rows) {
			const cid = row.commissionId;
			if (!grouped[cid]) {
				grouped[cid] = { commissionId: cid, commissionName: row.commissionName, outcomes: [] };
			}
			grouped[cid].outcomes.push({
				outcomeId: row.outcomeId,
				outcomeCode: row.outcomeCode,
				outcomeName: row.outcomeName,
				outcomeDescription: row.outcomeDescription,
				programCommissionId: row.programCommissionId,
			});
		}

		return Object.values(grouped);
	}
}
