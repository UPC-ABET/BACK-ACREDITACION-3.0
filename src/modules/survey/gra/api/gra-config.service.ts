import { Injectable, NotFoundException } from '@nestjs/common';
import { GraConfigRepository, GRA_SURVEY_TYPE } from '../core/gra-config.repository';
import { AcceptanceLevelService } from 'src/modules/survey/acceptance-levels/api/acceptance-levels.service';
import {
	CreateGraConfigDto,
	UpdateGraConfigDto,
	FilterGraConfigDto,
	ReplicateGraConfigDto,
	ListGraSurveyOutcomesDto,
} from '../model/gra.dtos';

@Injectable()
export class GraConfigService {
	constructor(
		private readonly configRepo: GraConfigRepository,
		private readonly acceptanceLevelService: AcceptanceLevelService,
	) {}

	async create(dto: CreateGraConfigDto) {
		const extra = {
			survey_type: GRA_SURVEY_TYPE,
			name_en: dto.name_en ?? null,
			description_en: dto.description_en ?? null,
			order: dto.order ?? null,
			program_id: dto.program_id ?? null,
			academic_period_id: dto.academic_period_id ?? null,
			commission_id: dto.commission_id ?? null,
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

	async getAll(filters?: FilterGraConfigDto) {
		return await this.configRepo.findAllGra(filters);
	}

	async getById(id: number) {
		const config = await this.configRepo.findOneGra(id);
		if (!config) throw new NotFoundException(`Configuración GRA con ID ${id} no encontrada`);
		return config;
	}

	async update(id: number, dto: UpdateGraConfigDto) {
		const current = await this.configRepo.findOneGra(id);
		if (!current) throw new NotFoundException(`Configuración GRA con ID ${id} no encontrada`);

		const currentExtra = (current?.extra as Record<string, any>) ?? {};

		const extra = {
			...currentExtra,
			...(dto.name_en !== undefined && { name_en: dto.name_en }),
			...(dto.description_en !== undefined && { description_en: dto.description_en }),
			...(dto.order !== undefined && { order: dto.order }),
			...(dto.program_id !== undefined && { program_id: dto.program_id }),
			...(dto.academic_period_id !== undefined && { academic_period_id: dto.academic_period_id }),
			...(dto.commission_id !== undefined && { commission_id: dto.commission_id }),
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
		const config = await this.configRepo.findOneGra(id);
		if (!config) throw new NotFoundException(`Configuración GRA con ID ${id} no encontrada`);
		return await this.configRepo.update(id, { is_active: false });
	}

	async replicate(dto: ReplicateGraConfigDto) {
		const sourceConfigs = await this.configRepo.findAllGra({
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
			const alreadyExists = await this.configRepo.existsGra(
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

		// Buscar el survey_type_id del tipo GRA para copiar niveles de aceptación
		const graTypeId = await this.configRepo.findSurveyTypeIdByCode(GRA_SURVEY_TYPE);
		let replicatedLevels = 0;
		if (graTypeId) {
			replicatedLevels = await this.acceptanceLevelService.copyFromPeriod({
				survey_type_id: graTypeId,
				source_academic_period_id: dto.source_academic_period_id,
				target_academic_period_id: dto.target_academic_period_id,
			});
		}

		return {
			replicated_configs: replicatedConfigs,
			total_source_configs: sourceConfigs.length,
			replicated_levels: replicatedLevels,
			message: `Se replicaron ${replicatedConfigs} configuraciones GRA y ${replicatedLevels} niveles de aceptación al período destino`,
		};
	}

	async listOutcomesForSurvey(dto: ListGraSurveyOutcomesDto) {
		const rows = await this.configRepo.findOutcomesGroupedByCommission(
			dto.program_id,
			dto.academic_period_id,
		);

		// Agrupar por commission_id
		const grouped: Record<
			number,
			{ commission_id: number; commission_name: any; outcomes: any[] }
		> = {};
		for (const row of rows) {
			const cid = row.commission_id;
			if (!grouped[cid]) {
				grouped[cid] = { commission_id: cid, commission_name: row.commission_name, outcomes: [] };
			}
			grouped[cid].outcomes.push({
				outcome_id: row.outcome_id,
				outcome_code: row.outcome_code,
				outcome_name: row.outcome_name,
				outcome_description: row.outcome_description,
				program_commission_id: row.program_commission_id,
			});
		}

		return Object.values(grouped);
	}
}
