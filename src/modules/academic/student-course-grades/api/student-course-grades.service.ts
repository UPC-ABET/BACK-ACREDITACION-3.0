import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StudentCourseGradeRepository } from '../core/student-course-grades.repository';
import { StudentCourseGradeValidation } from '../core/student-course-grades.validation';

import { CreateStudentCourseGradeDto, UpdateStudentCourseGradeDto } from '../model/student-course-grades.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class StudentCourseGradeService extends BaseService<StudentCourseGradeRepository> {
	constructor(
		protected readonly repository: StudentCourseGradeRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateStudentCourseGradeDto, manager?: EntityManager) {
		await StudentCourseGradeValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudentCourseGradeDto, manager?: EntityManager) {
		await StudentCourseGradeValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudentCourseGradeValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
