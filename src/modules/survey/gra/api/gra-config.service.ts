import { Injectable, NotFoundException } from '@nestjs/common';
import { GraConfigRepository, GRA_SURVEY_TYPE } from '../core/gra-config.repository';
import { CreateGraConfigDto, UpdateGraConfigDto, FilterGraConfigDto } from '../model/gra.dtos';

@Injectable()
export class GraConfigService {
	constructor(private readonly configRepo: GraConfigRepository) {}

	async create(dto: CreateGraConfigDto) {
		const extra = {
			survey_type: GRA_SURVEY_TYPE,
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
			...(dto.is_visible !== undefined && { is_visible: dto.is_visible }),
		};

		const updatePayload: Record<string, any> = { extra };
		if (dto.outcome_id !== undefined) updatePayload.outcome_id = dto.outcome_id;
		if (dto.name_es !== undefined) updatePayload.user_outcome_name = dto.name_es;
		if (dto.description_es !== undefined) updatePayload.user_outcome_description = dto.description_es;
		if (dto.is_active !== undefined) updatePayload.is_active = dto.is_active;

		return await this.configRepo.update(id, updatePayload);
	}

	async delete(id: number) {
		const config = await this.configRepo.findOneGra(id);
		if (!config) throw new NotFoundException(`Configuración GRA con ID ${id} no encontrada`);
		return await this.configRepo.update(id, { is_active: false });
	}
}
