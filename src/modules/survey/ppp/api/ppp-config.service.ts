import { Injectable, NotFoundException } from '@nestjs/common';
import { PppConfigRepository, PPP_SURVEY_TYPE } from '../core/ppp-config.repository';
import { PppValidation } from '../core/ppp.validation';
import {
	CreatePppConfigDto,
	UpdatePppConfigDto,
	FilterPppConfigDto,
	ReplicatePppConfigDto,
} from '../model/ppp.dtos';
import { PerformanceLevelService } from 'src/modules/academic/performance-levels/api/performance-levels.service';

@Injectable()
export class PppConfigService {
	constructor(
		private readonly configRepo: PppConfigRepository,
		private readonly acceptanceLevelService: PerformanceLevelService,
	) {}

	async create(dto: CreatePppConfigDto) {
		await PppValidation.validateCreateConfig(this.configRepo, dto);

		const extra = {
			surveyType: PPP_SURVEY_TYPE,
			nameEn: dto.nameEn ?? null,
			descriptionEn: dto.descriptionEn ?? null,
			order: dto.order ?? null,
			programId: dto.programId ?? null,
			academicPeriodId: dto.academicPeriodId ?? null,
			isVisible: dto.isVisible ?? true,
		};

		return await this.configRepo.create({
			outcomeId: dto.outcomeId,
			userOutcomeName: dto.nameEs as any,
			userOutcomeDescription: (dto.descriptionEs ?? null) as any,
			extra,
			isActive: true,
		});
	}

	async getAll(filters?: FilterPppConfigDto) {
		return await this.configRepo.findAllPpp(filters);
	}

	async getById(id: number) {
		const config = await this.configRepo.findOnePpp(id);
		if (!config) throw new NotFoundException(`PPP configuration with ID ${id} not found`);
		return config;
	}

	async update(id: number, dto: UpdatePppConfigDto) {
		await PppValidation.validateUpdateConfig(this.configRepo, id);

		const current = await this.configRepo.findOnePpp(id);
		const currentExtra = (current?.extra as Record<string, any>) ?? {};

		const extra = {
			...currentExtra,
			...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
			...(dto.descriptionEn !== undefined && { descriptionEn: dto.descriptionEn }),
			...(dto.order !== undefined && { order: dto.order }),
			...(dto.programId !== undefined && { programId: dto.programId }),
			...(dto.academicPeriodId !== undefined && { academicPeriodId: dto.academicPeriodId }),
			...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
		};

		const updatePayload: Record<string, any> = { extra };
		if (dto.outcomeId !== undefined) updatePayload.outcomeId = dto.outcomeId;
		if (dto.nameEs !== undefined) updatePayload.userOutcomeName = dto.nameEs;
		if (dto.descriptionEs !== undefined) updatePayload.userOutcomeDescription = dto.descriptionEs;
		if (dto.isActive !== undefined) updatePayload.isActive = dto.isActive;

		return await this.configRepo.update(id, updatePayload);
	}

	async delete(id: number) {
		await PppValidation.validateDeleteConfig(this.configRepo, id);
		return await this.configRepo.update(id, { isActive: false });
	}

	async replicate(dto: ReplicatePppConfigDto) {
		const sourceConfigs = await this.configRepo.findAllPpp({
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
			const alreadyExists = await this.configRepo.existsPpp(
				config.outcomeId,
				sourceExtra.programId,
				dto.targetAcademicPeriodId,
			);
			if (alreadyExists) continue;

			await this.configRepo.create({
				outcomeId: config.outcomeId,
				userOutcomeName: config.userOutcomeName,
				userOutcomeDescription: config.userOutcomeDescription,
				extra: { ...sourceExtra, academicPeriodId: dto.targetAcademicPeriodId },
				isActive: true,
			});
			replicatedConfigs++;
		}

		// Copy performance levels from the previous period to the new one
		const pppTypeId = await this.configRepo.findSurveyTypeIdByCode(PPP_SURVEY_TYPE);
		let replicatedLevels = 0;
		if (pppTypeId) {
			replicatedLevels = await this.acceptanceLevelService.copyFromPeriod({
				surveyTypeId: pppTypeId,
				sourceAcademicPeriodId: dto.sourceAcademicPeriodId,
				targetAcademicPeriodId: dto.targetAcademicPeriodId,
			});
		}

		return {
			replicatedConfigs,
			totalSourceConfigs: sourceConfigs.length,
			replicatedLevels,
			message: `Replicated ${replicatedConfigs} PPP configurations and ${replicatedLevels} performance levels to the target period`,
		};
	}
}
