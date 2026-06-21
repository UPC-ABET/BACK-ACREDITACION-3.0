import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { LcfcConfigRepository, LCFC_SURVEY_TYPE } from '../core/lcfc-config.repository';
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
	constructor(private readonly configRepo: LcfcConfigRepository) {}

	/**
	 * Generates LCFC configs for the given period (and optional program).
	 * School ownership is NOT checked — school filter is disabled for LCFC.
	 */
	private async generateForPeriod(
		programId: number | null | undefined,
		academicPeriodId: number,
		courseSectionIds?: number[],
	): Promise<{ created: number; skipped: number; configs: any[] }> {
		let sections = await this.configRepo.getCourseSectionsForPeriod(academicPeriodId, programId);

		if (courseSectionIds && courseSectionIds.length > 0) {
			sections = sections.filter((s) => courseSectionIds.includes(s.courseSectionId));
		}

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

			const extra: Record<string, unknown> = {
				survey_type: LCFC_SURVEY_TYPE,
				course_section_id: section.courseSectionId,
				course_id: section.courseId,
				course_name: section.courseName,
				section_code: section.sectionCode,
				academic_period_id: academicPeriodId,
				campus_id: section.campusId,
			};
			if (programId != null) extra.program_id = programId;

			const config = await this.configRepo.create({
				outcomeId,
				userOutcomeName: section.courseName as any,
				userOutcomeDescription: section.sectionCode as any,
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
		_schoolId: number,
		academicPeriodId: number,
	): Promise<{ created: number; skipped: number; configs: any[] }> {
		// School ownership check removed — LCFC does not filter by school.
		const latestPeriodId = await this.configRepo.findLatestAcademicPeriodId(dto.modalityTypeId);
		if (!latestPeriodId || latestPeriodId !== academicPeriodId) {
			throw new BadRequestException(lcfcValidationStrings.error.notLatestPeriod);
		}

		return this.generateForPeriod(dto.programId, academicPeriodId, dto.courseSectionIds);
	}

	async getAvailableSections(programId: number | null | undefined, academicPeriodId: number) {
		return this.configRepo.getCourseSectionsForPeriod(academicPeriodId, programId);
	}

	async getSectionOutcomes(courseSectionId: number, programId: number) {
		return this.configRepo.getSectionOutcomes(courseSectionId, programId);
	}

	async getSectionCommissions(courseSectionId: number, programId?: number | null) {
		return this.configRepo.getSectionCommissions(courseSectionId, programId);
	}

	async setDeadline(
		programId: number | null | undefined,
		academicPeriodId: number,
		maxRegisterDate: string,
	) {
		return this.configRepo.setDeadline(programId, academicPeriodId, maxRegisterDate);
	}

	async getDeadline(programId: number | null | undefined, academicPeriodId: number) {
		return this.configRepo.getDeadline(programId, academicPeriodId);
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
		sourcePeriodId: number;
		message: string;
	}> {
		let sourcePeriodId = dto.sourceAcademicPeriodId;
		if (!sourcePeriodId) {
			const resolved = await this.configRepo.findPreviousAcademicPeriodId(
				dto.targetAcademicPeriodId,
			);
			if (!resolved) {
				throw new BadRequestException(lcfcValidationStrings.error.noPreviousPeriod);
			}
			sourcePeriodId = resolved;
		}

		const generated = await this.generateForPeriod(dto.programId, dto.targetAcademicPeriodId);

		const [sourceConfigs, targetConfigs] = await Promise.all([
			this.configRepo.findAllLcfc({
				academicPeriodId: sourcePeriodId,
				programId: dto.programId ?? undefined,
			}),
			this.configRepo.findAllLcfc({
				academicPeriodId: dto.targetAcademicPeriodId,
				programId: dto.programId ?? undefined,
			}),
		]);

		const sectionKey = (config: { extra?: unknown }): string | null => {
			const extra = (config.extra as Record<string, any>) ?? {};
			const cid = extra.course_id ?? extra.courseId;
			const scode = extra.section_code ?? extra.sectionCode;
			return cid != null && scode != null ? `${cid}:${scode}` : null;
		};

		const sourceStatusBySection = new Map<string, boolean>();
		for (const config of sourceConfigs) {
			const key = sectionKey(config);
			if (key !== null) sourceStatusBySection.set(key, config.isActive ?? false);
		}

		let statusCopied = 0;
		for (const target of targetConfigs) {
			const key = sectionKey(target);
			if (key === null) continue;
			const sourceActive = sourceStatusBySection.get(key);
			if (sourceActive !== undefined && sourceActive !== target.isActive) {
				await this.configRepo.update(target.id, { isActive: sourceActive });
				statusCopied++;
			}
		}

		return {
			generated: generated.created,
			skipped: generated.skipped,
			statusCopied,
			sourcePeriodId,
			message: `Generated ${generated.created} configs (skipped ${generated.skipped}) and copied status for ${statusCopied} sections from period ${sourcePeriodId}`,
		};
	}

	async getAll(filters?: FilterLcfcConfigDto & { academicPeriodId?: number | null }) {
		const configs = await this.configRepo.findAllLcfc({
			programId: filters?.programId,
			academicPeriodId: filters?.academicPeriodId ?? undefined,
			isActive: filters?.isActive,
		});
		for (const config of configs) config.extra = camelizeKeys(config.extra);
		return configs;
	}

	async updateStatus(dto: UpdateLcfcConfigStatusDto): Promise<{ updated: number }> {
		const updated = await this.configRepo.updateStatuses(dto.updates, () => {
			throw new NotFoundException(lcfcValidationStrings.error.configNotFound);
		});
		return { updated };
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
		const existing = await this.findLcfcConfigOrFail(id);

		// Store commissionId in the extra JSON so the survey endpoint can filter by it.
		if (dto.commissionId != null) {
			const currentExtra = (existing.extra as Record<string, unknown>) ?? {};
			await this.configRepo.setCommissionId(id, dto.commissionId);
			// Remove commissionId from the DTO before passing to the base update
			const { commissionId: _removed, ...rest } = dto;
			if (Object.keys(rest).length > 0) {
				return await this.configRepo.update(id, rest);
			}
			return { ...existing, extra: { ...currentExtra, commission_id: dto.commissionId } };
		}

		return await this.configRepo.update(id, dto);
	}

	async deleteConfig(id: number) {
		const config = await this.findLcfcConfigOrFail(id);
		const extra = (config.extra as Record<string, any>) ?? {};
		const courseSectionId = extra.course_section_id ?? extra.courseSectionId ?? null;
		const academicPeriodId = extra.academic_period_id ?? extra.academicPeriodId ?? null;

		return await this.configRepo.deleteConfigWithSurveys(id, courseSectionId, academicPeriodId);
	}
}
