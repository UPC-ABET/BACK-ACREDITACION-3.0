import { Injectable, NotFoundException } from '@nestjs/common';
import { PppConfigRepository, PPP_SURVEY_TYPE } from '../core/ppp-config.repository';
import { AcceptanceLevelService } from 'src/modules/survey/acceptance-levels/api/acceptance-levels.service';
import { PppValidation } from '../core/ppp.validation';
import {
	CreatePppConfigDto,
	UpdatePppConfigDto,
	FilterPppConfigDto,
	ReplicatePppConfigDto,
} from '../model/ppp.dtos';

@Injectable()
export class PppConfigService {
	constructor(
		private readonly configRepo: PppConfigRepository,
		private readonly acceptanceLevelService: AcceptanceLevelService,
	) {}

	async create(dto: CreatePppConfigDto) {
		await PppValidation.validateCreateConfig(this.configRepo, dto);

		const extra = {
			survey_type: PPP_SURVEY_TYPE,
			name_en: dto.name_en ?? null,
			description_en: dto.description_en ?? null,
			order: dto.order ?? null,
			program_id: dto.program_id ?? null,
			academic_period_id: dto.academic_period_id ?? null,
			is_visible: dto.is_visible ?? true,
		};

		return await this.configRepo.create({
			outcome_id: dto.outcome_id,
			user_outcome_name: dto.name_es,
			user_outcome_description: dto.description_es ?? null,
			extra,
			is_active: true,
		});
	}

	async getAll(filters?: FilterPppConfigDto) {
		return await this.configRepo.findAllPpp(filters);
	}

	async getById(id: number) {
		const config = await this.configRepo.findOnePpp(id);
		if (!config) throw new NotFoundException(`Configuración PPP con ID ${id} no encontrada`);
		return config;
	}

	async update(id: number, dto: UpdatePppConfigDto) {
		await PppValidation.validateUpdateConfig(this.configRepo, id);

		const current = await this.configRepo.findOnePpp(id);
		const currentExtra = (current?.extra as Record<string, any>) ?? {};

		const extra = {
			...currentExtra,
			...(dto.name_en !== undefined && { name_en: dto.name_en }),
			...(dto.description_en !== undefined && { description_en: dto.description_en }),
			...(dto.order !== undefined && { order: dto.order }),
			...(dto.program_id !== undefined && { program_id: dto.program_id }),
			...(dto.academic_period_id !== undefined && { academic_period_id: dto.academic_period_id }),
			...(dto.is_visible !== undefined && { is_visible: dto.is_visible }),
		};

		const updatePayload: Record<string, any> = { extra };
		if (dto.outcome_id !== undefined) updatePayload.outcome_id = dto.outcome_id;
		if (dto.name_es !== undefined) updatePayload.user_outcome_name = dto.name_es;
		if (dto.description_es !== undefined)
			updatePayload.user_outcome_description = dto.description_es;
		if (dto.is_active !== undefined) updatePayload.is_active = dto.is_active;

		return await this.configRepo.update(id, updatePayload);
	}

	async delete(id: number) {
		await PppValidation.validateDeleteConfig(this.configRepo, id);
		return await this.configRepo.update(id, { is_active: false });
	}

	async replicate(dto: ReplicatePppConfigDto) {
		const sourceConfigs = await this.configRepo.findAllPpp({
			academic_period_id: dto.source_academic_period_id,
			...(dto.program_id && { program_id: dto.program_id }),
			is_active: true,
		});

		if (sourceConfigs.length === 0) {
			return {
				replicated_configs: 0,
				replicated_levels: 0,
				message: 'No se encontraron configuraciones en el período origen',
			};
		}

		let replicatedConfigs = 0;
		for (const config of sourceConfigs) {
			const sourceExtra = (config.extra as Record<string, any>) ?? {};
			const alreadyExists = await this.configRepo.existsPpp(
				config.outcome_id,
				sourceExtra.program_id,
				dto.target_academic_period_id,
			);
			if (alreadyExists) continue;

			await this.configRepo.create({
				outcome_id: config.outcome_id,
				user_outcome_name: config.user_outcome_name,
				user_outcome_description: config.user_outcome_description,
				extra: { ...sourceExtra, academic_period_id: dto.target_academic_period_id },
				is_active: true,
			});
			replicatedConfigs++;
		}

		// Copiar niveles de aceptación del período anterior al nuevo
		const pppTypeId = await this.configRepo.findSurveyTypeIdByCode(PPP_SURVEY_TYPE);
		let replicatedLevels = 0;
		if (pppTypeId) {
			replicatedLevels = await this.acceptanceLevelService.copyFromPeriod({
				survey_type_id: pppTypeId,
				source_academic_period_id: dto.source_academic_period_id,
				target_academic_period_id: dto.target_academic_period_id,
			});
		}

		return {
			replicated_configs: replicatedConfigs,
			total_source_configs: sourceConfigs.length,
			replicated_levels: replicatedLevels,
			message: `Se replicaron ${replicatedConfigs} configuraciones PPP y ${replicatedLevels} niveles de aceptación al período destino`,
		};
	}
}
