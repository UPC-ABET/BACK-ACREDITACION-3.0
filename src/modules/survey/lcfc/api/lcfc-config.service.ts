import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { LcfcConfigRepository, LCFC_SURVEY_TYPE } from '../core/lcfc-config.repository';
import {
	GenerateLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
} from '../model/lcfc.dtos';

@Injectable()
export class LcfcConfigService {
	constructor(private readonly configRepo: LcfcConfigRepository) {}

	async generateConfigs(
		dto: GenerateLcfcConfigDto,
	): Promise<{ created: number; skipped: number; configs: any[] }> {
		const sections = await this.configRepo.getCourseSectionsForPeriod(
			dto.academic_period_id,
			dto.program_id,
			dto.campus_id,
		);

		if (sections.length === 0) {
			throw new BadRequestException(
				'No se encontraron secciones de curso para el período y programa indicados.',
			);
		}

		const outcomeId = await this.configRepo.findFirstProgramOutcomeId(dto.program_id);
		if (!outcomeId) {
			throw new BadRequestException(
				`No se encontraron outcomes para el programa ${dto.program_id}. Verifique que existan outcomes en accreditation.outcomes.`,
			);
		}

		let created = 0;
		let skipped = 0;
		const configs: any[] = [];

		for (const section of sections) {
			const existing = await this.configRepo.findByCourseSection(
				section.course_section_id,
				dto.academic_period_id,
			);

			if (existing) {
				skipped++;
				configs.push({ ...existing, _status: 'skipped' });
				continue;
			}

			const extra = {
				survey_type: LCFC_SURVEY_TYPE,
				course_section_id: section.course_section_id,
				course_id: section.course_id,
				course_name: section.course_name,
				section_code: section.section_code,
				academic_period_id: dto.academic_period_id,
				program_id: dto.program_id,
				campus_id: dto.campus_id ?? section.campus_id,
			};

			const config = await this.configRepo.create({
				outcome_id: outcomeId,
				user_outcome_name: section.course_name as any,
				user_outcome_description: `Sección: ${section.section_code}` as any,
				extra,
				is_active: true,
			});

			created++;
			configs.push({ ...config, _status: 'created' });
		}

		return { created, skipped, configs };
	}

	async getAll(filters?: FilterLcfcConfigDto) {
		return await this.configRepo.findAllLcfc(filters);
	}

	async updateStatus(dto: UpdateLcfcConfigStatusDto): Promise<{ updated: number }> {
		let updated = 0;
		for (const item of dto.updates) {
			const existing = await this.configRepo.findOneById(item.config_id);
			if (!existing)
				throw new NotFoundException(`Configuración LCFC con ID ${item.config_id} no encontrada.`);
			await this.configRepo.update(item.config_id, { is_active: item.is_active });
			updated++;
		}
		return { updated };
	}
}
