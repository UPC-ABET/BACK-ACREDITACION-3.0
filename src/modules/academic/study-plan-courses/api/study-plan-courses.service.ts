import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StudyPlanCourseRepository } from '../core/study-plan-courses.repository';
import { StudyPlanCourseValidation } from '../core/study-plan-courses.validation';

import {
	CreateStudyPlanCourseDto,
	UpdateStudyPlanCourseDto,
	FilterStudyPlanCourseDto,
	EnableEvaluationDto,
	CreateStudyPlanCourseMaintenanceDto,
	StudyPlanCourseMaintenanceItem,
} from '../model/study-plan-courses.dtos';
import { EntityManager } from 'typeorm';
import { ScopeFilters } from 'src/commons/scope.dtos';

@Injectable()
export class StudyPlanCourseService extends BaseService<StudyPlanCourseRepository> {
	constructor(protected readonly repository: StudyPlanCourseRepository) {
		super(repository);
	}

	async create(dto: CreateStudyPlanCourseDto, manager?: EntityManager) {
		await StudyPlanCourseValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudyPlanCourseDto, manager?: EntityManager) {
		await StudyPlanCourseValidation.validateUpdate(this.repository, id, dto);

		const { extra, ...columns } = dto;
		if (extra) await this.repository.mergeExtra(id, extra);
		if (Object.keys(columns).length === 0) return await this.repository.findOneById(id);

		return await super.update(id, columns, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudyPlanCourseValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async enableEvaluation(id: number, dto: EnableEvaluationDto) {
		await StudyPlanCourseValidation.validateExists(this.repository, id);
		await this.repository.enableEvaluation(id, dto.isEvaluable);
	}

	async getByFilters(filters: FilterStudyPlanCourseDto & ScopeFilters) {
		return await this.repository.getByFilters(filters);
	}

	async createMaintenance(academicPeriodId: number, dto: CreateStudyPlanCourseMaintenanceDto) {
		const studyPlanAcademicPeriodId = await this.repository.findStudyPlanAcademicPeriodId(
			dto.studyPlanId,
			academicPeriodId,
		);
		const existingCourseId =
			dto.courseId ??
			(dto.newCourse ? await this.repository.findCourseIdByCode(dto.newCourse.code) : null);

		await StudyPlanCourseValidation.validateMaintenanceCreate(
			this.repository,
			studyPlanAcademicPeriodId,
			existingCourseId,
			dto,
		);

		const id = await this.repository.createMaintenance(dto, studyPlanAcademicPeriodId as number);
		return await this.getMaintenanceItem(id);
	}

	async deleteMaintenance(id: number) {
		await StudyPlanCourseValidation.validateMaintenanceDelete(this.repository, id);
		await this.repository.remove(id);
		return { id };
	}

	private async getMaintenanceItem(id: number): Promise<StudyPlanCourseMaintenanceItem | null> {
		const spc = await this.repository.findByIdWithCourse(id);
		if (!spc) return null;
		return {
			id: spc.id,
			courseId: spc.courseId,
			courseCode: spc.course.code,
			courseName: spc.course.name,
			learningOutcome: spc.course.learningOutcome,
			levelTypeId: spc.levelTypeId,
			isElective: spc.isElective,
		};
	}
}
