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
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
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

		return this.generateForPeriod(dto.programId, dto.academicPeriodId, dto.courseSectionIds);
	}

	async getAvailableSections(programId: number, academicPeriodId: number) {
		return this.configRepo.getCourseSectionsForPeriod(academicPeriodId, programId);
	}

	async getSectionOutcomes(courseSectionId: number, programId: number) {
		return this.configRepo.getSectionOutcomes(courseSectionId, programId);
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
				programId: dto.programId,
			}),
			this.configRepo.findAllLcfc({
				academicPeriodId: dto.targetAcademicPeriodId,
				programId: dto.programId,
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
		const config = await this.findLcfcConfigOrFail(id);
		const extra = (config.extra as Record<string, any>) ?? {};
		const courseSectionId = extra.course_section_id ?? extra.courseSectionId ?? null;
		const academicPeriodId = extra.academic_period_id ?? extra.academicPeriodId ?? null;

		return await this.dataSource.transaction(async (manager) => {
			// Remove the surveys generated for this section (and their notifications/scores)
			// so the course section can later be deleted; otherwise the FKs from
			// evidence.surveys keep the section "in use" even after its config is gone.
			if (courseSectionId && academicPeriodId) {
				const surveys = await manager.query(
					`SELECT s.id FROM evidence.surveys s
					 WHERE s.survey_type_id = (SELECT id FROM core.types WHERE code = $1)
					   AND s.course_section_id = $2
					   AND s.academic_period_id = $3`,
					[TYPE_CODES.SURVEY_TYPE.LCFC, courseSectionId, academicPeriodId],
				);
				const surveyIds = surveys.map((r: { id: number }) => r.id);
				if (surveyIds.length > 0) {
					await manager.query(`DELETE FROM survey.scores WHERE survey_id = ANY($1)`, [surveyIds]);
					await manager.query(`DELETE FROM survey.notifications WHERE survey_id = ANY($1)`, [
						surveyIds,
					]);
					await manager.query(`DELETE FROM evidence.surveys WHERE id = ANY($1)`, [surveyIds]);
				}
			}
			return await manager.delete(OutcomeConfigEntity, id);
		});
	}
}
