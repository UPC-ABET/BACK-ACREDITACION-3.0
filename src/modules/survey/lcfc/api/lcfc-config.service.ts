import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { LcfcConfigRepository, LCFC_SURVEY_TYPE } from '../core/lcfc-config.repository';
import {
	GenerateLcfcConfigDto,
	CloneLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
} from '../model/lcfc.dtos';
import { camelizeKeys } from 'src/libs/case.functions';
import { lcfcValidationStrings } from '../config/strings/lcfc.validation';

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
			throw new BadRequestException(lcfcValidationStrings.error.noCourseSections);
		}

		const outcomeId = await this.configRepo.findFirstProgramOutcomeId(dto.programId);
		if (!outcomeId) {
			throw new BadRequestException(lcfcValidationStrings.error.noProgramOutcomes);
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

	/**
	 * Clones an LCFC configuration into a new period: generates the target-period configs
	 * (idempotent) and copies the active/inactive status of each course from the source
	 * period, matching by course (course sections differ across periods).
	 */
	async cloneConfig(dto: CloneLcfcConfigDto): Promise<{
		generated: number;
		skipped: number;
		statusCopied: number;
		message: string;
	}> {
		const generated = await this.generateConfigs({
			academicPeriodId: dto.targetAcademicPeriodId,
			programId: dto.programId,
			campusId: dto.campusId,
		});

		const [sourceConfigs, targetConfigs] = await Promise.all([
			this.configRepo.findAllLcfc({
				academicPeriodId: dto.sourceAcademicPeriodId,
				programId: dto.programId,
			}),
			this.configRepo.findAllLcfc({
				academicPeriodId: dto.targetAcademicPeriodId,
				programId: dto.programId,
			}),
		]);

		const courseId = (config: { extra?: unknown }): number | null => {
			const extra = (config.extra as Record<string, any>) ?? {};
			const value = extra.course_id ?? extra.courseId;
			return value == null ? null : Number(value);
		};

		const sourceStatusByCourse = new Map<number, boolean>();
		for (const config of sourceConfigs) {
			const id = courseId(config);
			if (id !== null) sourceStatusByCourse.set(id, config.isActive ?? false);
		}

		let statusCopied = 0;
		for (const target of targetConfigs) {
			const id = courseId(target);
			if (id === null) continue;
			const sourceActive = sourceStatusByCourse.get(id);
			if (sourceActive !== undefined && sourceActive !== target.isActive) {
				await this.configRepo.update(target.id, { isActive: sourceActive });
				statusCopied++;
			}
		}

		return {
			generated: generated.created,
			skipped: generated.skipped,
			statusCopied,
			message: `Generated ${generated.created} configs (skipped ${generated.skipped}) and copied status for ${statusCopied} courses from the source period`,
		};
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
			if (!existing) throw new NotFoundException(lcfcValidationStrings.error.configNotFound);
			await this.configRepo.update(item.configId, { isActive: item.isActive });
			updated++;
		}
		return { updated };
	}
}
