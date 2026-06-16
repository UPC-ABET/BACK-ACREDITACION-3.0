import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LcfcConfigRepository, LCFC_SURVEY_TYPE } from '../core/lcfc-config.repository';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import {
	GenerateLcfcConfigDto,
	CloneLcfcConfigDto,
	FilterLcfcConfigDto,
	UpdateLcfcConfigStatusDto,
	UpdateLcfcConfigDto,
} from '../model/lcfc.dtos';
import { camelizeKeys } from 'src/libs/case.functions';
import { lcfcValidationStrings } from '../config/strings/lcfc.validation';

@Injectable()
export class LcfcConfigService {
	constructor(
		private readonly configRepo: LcfcConfigRepository,
		private readonly dataSource: DataSource,
	) {}

	/**
	 * Generates LCFC configs for the given program/period. Only enforces "must be the latest
	 * period" and school ownership at the public entry point (generateConfigs); cloneConfig
	 * reuses this for an arbitrary target period.
	 */
	private async generateForPeriod(
		programId: number,
		academicPeriodId: number,
	): Promise<{ created: number; skipped: number; configs: any[] }> {
		const sections = await this.configRepo.getCourseSectionsForPeriod(academicPeriodId, programId);

		if (sections.length === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noCourseSections);
		}

		const outcomeId = await this.configRepo.findFirstProgramOutcomeId(programId);
		if (!outcomeId) {
			throw new BadRequestException(lcfcValidationStrings.error.noProgramOutcomes);
		}

		let created = 0;
		let skipped = 0;
		const configs: any[] = [];

		for (const section of sections) {
			const existing = await this.configRepo.findByCourseSection(
				section.courseSectionId,
				academicPeriodId,
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
				academic_period_id: academicPeriodId,
				program_id: programId,
				campus_id: section.campusId,
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

	async generateConfigs(
		dto: GenerateLcfcConfigDto,
		schoolId: number,
	): Promise<{ created: number; skipped: number; configs: any[] }> {
		const inSchool = await this.configRepo.isProgramInSchool(dto.programId, schoolId);
		if (!inSchool) {
			throw new BadRequestException(lcfcValidationStrings.error.programNotInSchool);
		}

		const latestPeriodId = await this.configRepo.findLatestAcademicPeriodId(dto.modalityTypeId);
		if (!latestPeriodId || latestPeriodId !== dto.academicPeriodId) {
			throw new BadRequestException(lcfcValidationStrings.error.notLatestPeriod);
		}

		return this.generateForPeriod(dto.programId, dto.academicPeriodId);
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
		const generated = await this.generateForPeriod(dto.programId, dto.targetAcademicPeriodId);

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
		return await this.dataSource.transaction(async (manager) => {
			let updated = 0;
			for (const item of dto.updates) {
				const existing = await manager.findOne(OutcomeConfigEntity, {
					where: { id: item.configId },
				});
				const extra = (existing?.extra as Record<string, any>) ?? {};
				if (!existing || extra.survey_type !== LCFC_SURVEY_TYPE) {
					throw new NotFoundException(lcfcValidationStrings.error.configNotFound);
				}
				await manager.update(OutcomeConfigEntity, item.configId, { isActive: item.isActive });
				updated++;
			}
			return { updated };
		});
	}

	private async findLcfcConfigOrFail(id: number) {
		const existing = await this.configRepo.findOneById(id);
		const extra = (existing?.extra as Record<string, any>) ?? {};
		if (!existing || extra.survey_type !== LCFC_SURVEY_TYPE) {
			throw new NotFoundException(lcfcValidationStrings.error.configNotFound);
		}
		return existing;
	}

	async getConfigById(id: number) {
		const existing = await this.findLcfcConfigOrFail(id);
		existing.extra = camelizeKeys(existing.extra);
		return existing;
	}

	async updateConfig(id: number, dto: UpdateLcfcConfigDto) {
		await this.findLcfcConfigOrFail(id);
		return await this.configRepo.update(id, dto);
	}

	async deleteConfig(id: number) {
		await this.findLcfcConfigOrFail(id);
		return await this.configRepo.remove(id);
	}
}
