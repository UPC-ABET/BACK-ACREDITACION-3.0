import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StudyPlanAcademicPeriodRepository } from '../core/study-plan-academic-periods.repository';
import { StudyPlanAcademicPeriodValidation } from '../core/study-plan-academic-periods.validation';

import {
	CreateStudyPlanAcademicPeriodDto,
	UpdateStudyPlanAcademicPeriodDto,
} from '../model/study-plan-academic-periods.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class StudyPlanAcademicPeriodService extends BaseService<StudyPlanAcademicPeriodRepository> {
	constructor(
		protected readonly repository: StudyPlanAcademicPeriodRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateStudyPlanAcademicPeriodDto, manager?: EntityManager) {
		await StudyPlanAcademicPeriodValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudyPlanAcademicPeriodDto, manager?: EntityManager) {
		await StudyPlanAcademicPeriodValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudyPlanAcademicPeriodValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
