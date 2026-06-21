import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { AccreditorRepository } from '../core/accreditors.repository';
import { AccreditorValidation } from '../core/accreditors.validation';

import { CreateAccreditorDto, UpdateAccreditorDto } from '../model/accreditors.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class AccreditorService extends BaseService<AccreditorRepository> {
	constructor(protected readonly repository: AccreditorRepository) {
		super(repository);
	}

	async create(dto: CreateAccreditorDto, manager?: EntityManager) {
		await AccreditorValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateAccreditorDto, manager?: EntityManager) {
		await AccreditorValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await AccreditorValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
