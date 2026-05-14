import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StudentSectionEnrollmentRepository } from '../core/student-section-enrollments.repository';
import { StudentSectionEnrollmentValidation } from '../core/student-section-enrollments.validation';

import { CreateStudentSectionEnrollmentDto, UpdateStudentSectionEnrollmentDto } from '../model/student-section-enrollments.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class StudentSectionEnrollmentService extends BaseService<StudentSectionEnrollmentRepository> {
	constructor(
		protected readonly repository: StudentSectionEnrollmentRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateStudentSectionEnrollmentDto, manager?: EntityManager) {
		await StudentSectionEnrollmentValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudentSectionEnrollmentDto, manager?: EntityManager) {
		await StudentSectionEnrollmentValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudentSectionEnrollmentValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
