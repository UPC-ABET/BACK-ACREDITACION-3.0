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
			dto.academicPeriodId,
			dto.programId,
			dto.campusId,
		);

		if (sections.length === 0) {
			throw new BadRequestException(
				'No se encontraron secciones de curso para el período y programa indicados.',
			);
		}

		const outcomeId = await this.configRepo.findFirstProgramOutcomeId(dto.programId);
		if (!outcomeId) {
			throw new BadRequestException(
				`No se encontraron outcomes para el programa ${dto.programId}. Verifique que existan outcomes en accreditation.outcomes.`,
			);
		}

		let created = 0;
		let skipped = 0;
		const configs: any[] = [];

		for (const section of sections) {
			const existing = await this.configRepo.findByCourseSection(
				section.courseSectionId,
				dto.academicPeriodId,
			);

			if (existing) {
				skipped++;
				configs.push({ ...existing, _status: 'skipped' });
				continue;
			}

			const extra = {
				surveyType: LCFC_SURVEY_TYPE,
				courseSectionId: section.courseSectionId,
				courseId: section.courseId,
				courseName: section.courseName,
				sectionCode: section.sectionCode,
				academicPeriodId: dto.academicPeriodId,
				programId: dto.programId,
				campusId: dto.campusId ?? section.campusId,
			};

			const config = await this.configRepo.create({
				outcomeId: outcomeId,
				userOutcomeName: section.courseName as any,
				userOutcomeDescription: `Sección: ${section.sectionCode}` as any,
				extra,
				isActive: true,
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
			const existing = await this.configRepo.findOneById(item.configId);
			if (!existing)
				throw new NotFoundException(`Configuración LCFC con ID ${item.configId} no encontrada.`);
			await this.configRepo.update(item.configId, { isActive: item.isActive });
			updated++;
		}
		return { updated };
	}
}
