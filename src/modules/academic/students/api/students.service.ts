import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BaseService } from 'src/commons/base.service';
import { StudentRepository } from '../core/students.repository';
import { StudentValidation } from '../core/students.validation';
import { CreateStudentDto, UpdateStudentDto } from '../model/students.dtos';

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
		if (filters.code !== undefined) {
			const students = this.normalizeJsonbColumns(await this.repository.findByPartialCode(filters));
			return this.attachActiveSections(students);
		}
		return super.getByFilters(filters);
	}

	/** Enriches student search results with the course sections they're currently enrolled in. */
	private async attachActiveSections(students: any[]) {
		const studentIds = students.map((student) => student.id);
		const sectionRows = await this.repository.findActiveSectionCodesByStudentIds(studentIds);

		const sectionsByStudentId = new Map<number, string[]>();
		for (const row of sectionRows) {
			const codes = sectionsByStudentId.get(row.studentId) ?? [];
			codes.push(row.sectionCode);
			sectionsByStudentId.set(row.studentId, codes);
		}

		return students.map((student) => ({
			...student,
			sections: sectionsByStudentId.get(student.id) ?? [],
		}));
	}
}
