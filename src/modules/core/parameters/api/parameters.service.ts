import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ParameterRepository } from '../core/parameters.repository';
import { ParameterValidation } from '../core/parameters.validation';

import { CreateParameterDto, UpdateParameterDto } from '../model/parameters.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class ParameterService extends BaseService<ParameterRepository> {
	constructor(protected readonly repository: ParameterRepository) {
		super(repository);
	}

	async create(dto: CreateParameterDto, manager?: EntityManager) {
		await ParameterValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateParameterDto, manager?: EntityManager) {
		await ParameterValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ParameterValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
