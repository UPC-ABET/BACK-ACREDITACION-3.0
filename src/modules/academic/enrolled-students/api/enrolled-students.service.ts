import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EnrolledStudentRepository } from '../core/enrolled-students.repository';
import { EnrolledStudentValidation } from '../core/enrolled-students.validation';

import { CreateEnrolledStudentDto, UpdateEnrolledStudentDto } from '../model/enrolled-students.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class EnrolledStudentService extends BaseService<EnrolledStudentRepository> {
	constructor(
		protected readonly repository: EnrolledStudentRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateEnrolledStudentDto, manager?: EntityManager) {
		await EnrolledStudentValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateEnrolledStudentDto, manager?: EntityManager) {
		await EnrolledStudentValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await EnrolledStudentValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
