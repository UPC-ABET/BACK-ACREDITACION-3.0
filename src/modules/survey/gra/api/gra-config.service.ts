import { Injectable, NotFoundException } from '@nestjs/common';
import { GraConfigRepository, GRA_SURVEY_TYPE } from '../core/gra-config.repository';
import type { GraOutcomeRow } from '../core/gra-config.repository';
import {
	CreateGraConfigDto,
	UpdateGraConfigDto,
	FilterGraConfigDto,
	ReplicateGraConfigDto,
	ListGraSurveyOutcomesDto,
} from '../model/gra.dtos';
import { PerformanceLevelService } from 'src/modules/academic/performance-levels/api/performance-levels.service';
import { graValidationStrings } from '../config/strings/gra.validation';
import type { I18nText } from 'src/shared/types/i18n';

@Injectable()
export class GraConfigService {
	constructor(
		private readonly configRepo: GraConfigRepository,
		private readonly acceptanceLevelService: PerformanceLevelService,
	) {}

	async create(dto: CreateGraConfigDto, academicPeriodId: number) {
		const extra = {
			surveyType: GRA_SURVEY_TYPE,
			nameEn: dto.nameEn ?? null,
			descriptionEn: dto.descriptionEn ?? null,
			order: dto.order ?? null,
			programId: dto.programId ?? null,
			academicPeriodId,
			commissionId: dto.commissionId ?? null,
			isVisible: dto.isVisible ?? true,
		};

		return await this.configRepo.create({
			outcomeId: dto.outcomeId,
			// user_outcome_name/description are I18nText jsonb columns but store the bare ES string;
			// the EN variant lives in extra.nameEn (mirrored on the read side, e.g. ppp-survey.service).
			userOutcomeName: dto.nameEs as unknown as I18nText,
			userOutcomeDescription: (dto.descriptionEs ?? null) as unknown as I18nText,
			extra,
			isActive: true,
		});
	}

	async getAll(filters?: FilterGraConfigDto & { academicPeriodId?: number | null }) {
		const configs = await this.configRepo.findAllGra({
			...filters,
			academicPeriodId: filters?.academicPeriodId ?? undefined,
		});
		return configs;
	}

	async getById(id: number) {
		const config = await this.configRepo.findOneGra(id);
		if (!config) throw new NotFoundException(graValidationStrings.error.configNotFound);
		return config;
	}

	async update(id: number, dto: UpdateGraConfigDto) {
		const current = await this.configRepo.findOneGra(id);
		if (!current) throw new NotFoundException(graValidationStrings.error.configNotFound);

		const currentExtra = (current?.extra as Record<string, any>) ?? {};

		const extra = {
			...currentExtra,
			...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
			...(dto.descriptionEn !== undefined && { descriptionEn: dto.descriptionEn }),
			...(dto.order !== undefined && { order: dto.order }),
			...(dto.programId !== undefined && { programId: dto.programId }),
			...(dto.commissionId !== undefined && { commissionId: dto.commissionId }),
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
		const config = await this.configRepo.findOneGra(id);
		if (!config) throw new NotFoundException(graValidationStrings.error.configNotFound);
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

	async listOutcomesForSurvey(dto: ListGraSurveyOutcomesDto, academicPeriodId: number) {
		const rows = await this.configRepo.findOutcomesGroupedByCommission(
			dto.programId,
			academicPeriodId,
		);

		type GroupedCommission = {
			commissionId: number;
			commissionName: GraOutcomeRow['commissionName'];
			outcomes: Omit<GraOutcomeRow, 'commissionId' | 'commissionName'>[];
		};
		const grouped: Record<number, GroupedCommission> = {};
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
