import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StatusRepository } from '../core/statuses.repository';
import { StatusValidation } from '../core/statuses.validation';

import { CreateStatusDto, UpdateStatusDto } from '../model/statuses.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class StatusService extends BaseService<StatusRepository> {
	constructor(
		protected readonly repository: StatusRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateStatusDto, manager?: EntityManager) {
		await StatusValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStatusDto, manager?: EntityManager) {
		await StatusValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StatusValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
