import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StudentCourseOutcomeGradeRepository } from '../core/student-course-outcome-grades.repository';
import { StudentCourseOutcomeGradeValidation } from '../core/student-course-outcome-grades.validation';

import {
	CreateStudentCourseOutcomeGradeDto,
	UpdateStudentCourseOutcomeGradeDto,
} from '../model/student-course-outcome-grades.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class StudentCourseOutcomeGradeService extends BaseService<StudentCourseOutcomeGradeRepository> {
	constructor(protected readonly repository: StudentCourseOutcomeGradeRepository) {
		super(repository);
	}

	async create(dto: CreateStudentCourseOutcomeGradeDto, manager?: EntityManager) {
		await StudentCourseOutcomeGradeValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudentCourseOutcomeGradeDto, manager?: EntityManager) {
		await StudentCourseOutcomeGradeValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudentCourseOutcomeGradeValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
