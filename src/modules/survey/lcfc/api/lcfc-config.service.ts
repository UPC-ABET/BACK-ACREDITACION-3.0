import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { LcfcConfigRepository, LCFC_SURVEY_TYPE } from '../core/lcfc-config.repository';
import {
	GenerateLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
} from '../model/lcfc.dtos';
import { camelizeKeys } from 'src/libs/case.functions';

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
				'No course sections found for the specified period and program.',
			);
		}

		const outcomeId = await this.configRepo.findFirstProgramOutcomeId(dto.programId);
		if (!outcomeId) {
			throw new BadRequestException(
				`No outcomes found for program ${dto.programId}. Verify that outcomes exist in accreditation.outcomes.`,
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
				survey_type: LCFC_SURVEY_TYPE,
				course_section_id: section.courseSectionId,
				course_id: section.courseId,
				course_name: section.courseName,
				section_code: section.sectionCode,
				academic_period_id: dto.academicPeriodId,
				program_id: dto.programId,
				campus_id: dto.campusId ?? section.campusId,
			};

			const config = await this.configRepo.create({
				outcomeId: outcomeId,
				userOutcomeName: section.courseName as any,
				userOutcomeDescription: `Section: ${section.sectionCode}` as any,
				extra,
				isActive: true,
			});

			created++;
			configs.push({ ...config, _status: 'created' });
		}

		return { created, skipped, configs };
	}

	async getAll(filters?: FilterLcfcConfigDto) {
		const configs = await this.configRepo.findAllLcfc(filters);
		for (const config of configs) config.extra = camelizeKeys(config.extra);
		return configs;
	}

	async updateStatus(dto: UpdateLcfcConfigStatusDto): Promise<{ updated: number }> {
		let updated = 0;
		for (const item of dto.updates) {
			const existing = await this.configRepo.findOneById(item.configId);
			if (!existing)
				throw new NotFoundException(`LCFC configuration with ID ${item.configId} not found.`);
			await this.configRepo.update(item.configId, { isActive: item.isActive });
			updated++;
		}
		return { updated };
	}
}
