import { Injectable, NotFoundException } from '@nestjs/common';
import { PppConfigRepository, PPP_SURVEY_TYPE } from '../core/ppp-config.repository';
import { PppValidation } from '../core/ppp.validation';
import { pppValidationStrings } from '../config/strings/ppp.validation';
import {
	CreatePppConfigDto,
	UpdatePppConfigDto,
	FilterPppConfigDto,
	ReplicatePppConfigDto,
} from '../model/ppp.dtos';
import { PerformanceLevelService } from 'src/modules/academic/performance-levels/api/performance-levels.service';
import { camelizeKeys } from 'src/libs/case.functions';

@Injectable()
export class PppConfigService {
	constructor(
		private readonly configRepo: PppConfigRepository,
		private readonly acceptanceLevelService: PerformanceLevelService,
	) {}

	async create(dto: CreatePppConfigDto) {
		await PppValidation.validateCreateConfig(this.configRepo, dto);

		const extra = {
			survey_type: PPP_SURVEY_TYPE,
			name_en: dto.nameEn ?? null,
			description_en: dto.descriptionEn ?? null,
			order: dto.order ?? null,
			program_id: dto.programId ?? null,
			academic_period_id: dto.academicPeriodId ?? null,
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

	async getAll(filters?: FilterPppConfigDto) {
		const configs = await this.configRepo.findAllPpp(filters);
		for (const config of configs) config.extra = camelizeKeys(config.extra);
		return configs;
	}

	async getById(id: number) {
		const config = await this.configRepo.findOnePpp(id);
		if (!config) throw new NotFoundException(pppValidationStrings.error.configNotFound);
		config.extra = camelizeKeys(config.extra);
		return config;
	}

	async update(id: number, dto: UpdatePppConfigDto) {
		await PppValidation.validateUpdateConfig(this.configRepo, id);

		const current = await this.configRepo.findOnePpp(id);
		const currentExtra = (current?.extra as Record<string, any>) ?? {};

		const extra = {
			...currentExtra,
			...(dto.nameEn !== undefined && { name_en: dto.nameEn }),
			...(dto.descriptionEn !== undefined && { description_en: dto.descriptionEn }),
			...(dto.order !== undefined && { order: dto.order }),
			...(dto.programId !== undefined && { program_id: dto.programId }),
			...(dto.academicPeriodId !== undefined && { academic_period_id: dto.academicPeriodId }),
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
