import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProgramRepository } from '../core/programs.repository';
import { ProgramValidation } from '../core/programs.validation';
import { CreateProgramDto, FilterProgramDto, UpdateProgramDto } from '../model/programs.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class ProgramService extends BaseService<ProgramRepository> {
	constructor(protected readonly repository: ProgramRepository) {
		super(repository);
	}

	async create(dto: CreateProgramDto, manager?: EntityManager) {
		await ProgramValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateProgramDto, manager?: EntityManager) {
		await ProgramValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ProgramValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getByFilters(filters: FilterProgramDto) {
		return await this.repository.getByFilters(filters);
	}

	async getByModality(modalityTypeId: number) {
		return await this.repository.findByModality(modalityTypeId);
	}
}
