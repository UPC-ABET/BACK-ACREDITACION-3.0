import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StudyPlanRepository } from '../core/study-plans.repository';
import { StudyPlanValidation } from '../core/study-plans.validation';

import {
	CreateStudyPlanDto,
	UpdateStudyPlanDto,
	StudyPlanMaintenanceQueryDto,
	UpdateStudyPlanMaintenanceDto,
	CreateStudyPlanMaintenanceDto,
	StudyPlanMaintenanceItem,
	StudyPlanCourseViewItem,
	StudyPlanLevelGroup,
	StudyPlanCoursesView,
} from '../model/study-plans.dtos';
import { EntityManager } from 'typeorm';
import { StudyPlanEntity } from '../model/study-plans.entity';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';

// extra.grade_type_id has been set by hand in SQL until now, so it may hold a string or even a
// type code; anything that is not a positive integer reads as "no grade type designated".
function toGradeTypeId(value: unknown): number | null {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

@Injectable()
export class StudyPlanService extends BaseService<StudyPlanRepository> {
	constructor(protected readonly repository: StudyPlanRepository) {
		super(repository);
	}

	async create(dto: CreateStudyPlanDto, manager?: EntityManager) {
		await StudyPlanValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudyPlanDto, manager?: EntityManager) {
		await StudyPlanValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudyPlanValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getMaintenanceList(
		modalityTypeId: number,
		query: StudyPlanMaintenanceQueryDto,
	): Promise<PaginatedResult<StudyPlanMaintenanceItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [plans, total] = await this.repository.findMaintenancePage(
			modalityTypeId,
			query.programId,
			query.search,
			skip,
			take,
		);

		return toPaginated(
			plans.map((plan) => this.toMaintenanceItem(plan)),
			total,
			page,
			pageSize,
		);
	}

	async createMaintenance(
		modalityTypeId: number,
		academicPeriodId: number,
		dto: CreateStudyPlanMaintenanceDto,
	) {
		await StudyPlanValidation.validateMaintenanceCreate(
			this.repository,
			modalityTypeId,
			academicPeriodId,
			dto,
		);
		const created = await this.repository.createWithPeriod(
			dto.programId,
			dto.code,
			academicPeriodId,
		);
		return await this.getMaintenanceItem(created.id);
	}

	async updateMaintenance(id: number, dto: UpdateStudyPlanMaintenanceDto) {
		await StudyPlanValidation.validateMaintenanceUpdate(this.repository, id, dto);
		await this.repository.update(id, dto);
		return await this.getMaintenanceItem(id);
	}

	async deleteMaintenance(id: number) {
		await StudyPlanValidation.validateMaintenanceDelete(this.repository, id);
		await this.repository.remove(id);
		return { id };
	}

	async getCoursesView(
		studyPlanId: number,
		academicPeriodId: number,
	): Promise<StudyPlanCoursesView> {
		const rows = await this.repository.findCoursesForView(studyPlanId, academicPeriodId);

		const levelsMap = new Map<number, StudyPlanLevelGroup>();
		const electives: StudyPlanCourseViewItem[] = [];

		for (const spc of rows) {
			const item: StudyPlanCourseViewItem = {
				id: spc.id,
				courseId: spc.courseId,
				courseCode: spc.course.code,
				courseName: spc.course.name,
				learningOutcome: spc.course.learningOutcome,
				gradeTypeId: toGradeTypeId(spc.extra?.gradeTypeId),
			};

			if (spc.isElective) {
				electives.push(item);
				continue;
			}

			const level = Number(spc.levelType.extra?.level ?? 0);
			let group = levelsMap.get(level);
			if (!group) {
				group = { level, levelTypeId: spc.levelTypeId, levelName: spc.levelType.name, courses: [] };
				levelsMap.set(level, group);
			}
			group.courses.push(item);
		}

		const levels = Array.from(levelsMap.values()).sort((a, b) => a.level - b.level);
		return { levels, electives };
	}

	private async getMaintenanceItem(id: number): Promise<StudyPlanMaintenanceItem | null> {
		const plan = await this.repository.findByIdWithProgram(id);
		return plan ? this.toMaintenanceItem(plan) : null;
	}

	private toMaintenanceItem(plan: StudyPlanEntity): StudyPlanMaintenanceItem {
		return {
			id: plan.id,
			code: plan.code,
			programId: plan.programId,
			programName: plan.program.name,
		};
	}
}
