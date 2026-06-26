import { Injectable } from '@nestjs/common';
import { ILike } from 'typeorm';
import { BaseService } from 'src/commons/base.service';
import { StudentRepository } from '../core/students.repository';
import { StudentValidation } from '../core/students.validation';

import { CreateStudentDto, UpdateStudentDto } from '../model/students.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class StudentService extends BaseService<StudentRepository> {
	constructor(protected readonly repository: StudentRepository) {
		super(repository);
	}

	async create(dto: CreateStudentDto, manager?: EntityManager) {
		await StudentValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudentDto, manager?: EntityManager) {
		await StudentValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudentValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getByFilters(filters: Record<string, any>) {
		const { code, ...rest } = filters;
		if (code !== undefined) {
			return this.normalizeJsonbColumns(
				await this.repository.findByCondition({
					where: { ...rest, code: ILike(`%${code}%`) },
				} as any),
			);
		}
		return super.getByFilters(filters);
	}
}
