import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { FacultyRepository } from '../core/faculties.repository';
import { FacultyValidation } from '../core/faculties.validation';

import { CreateFacultyDto, UpdateFacultyDto } from '../model/faculties.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class FacultyService extends BaseService<FacultyRepository> {
	constructor(
		protected readonly repository: FacultyRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateFacultyDto, manager?: EntityManager) {
		await FacultyValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateFacultyDto, manager?: EntityManager) {
		await FacultyValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await FacultyValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
