import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProfessorRepository } from '../core/professors.repository';
import { ProfessorValidation } from '../core/professors.validation';

import { CreateProfessorDto, UpdateProfessorDto } from '../model/professors.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ProfessorService extends BaseService<ProfessorRepository> {
	constructor(
		protected readonly repository: ProfessorRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateProfessorDto, manager?: EntityManager) {
		await ProfessorValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateProfessorDto, manager?: EntityManager) {
		await ProfessorValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ProfessorValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getByUserId(user_id: number) {
    return await this.repository.getByUserId(user_id);
}
}
