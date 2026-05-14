import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { InstrumentRepository } from '../core/instruments.repository';
import { InstrumentValidation } from '../core/instruments.validation';

import { CreateInstrumentDto, UpdateInstrumentDto } from '../model/instruments.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class InstrumentService extends BaseService<InstrumentRepository> {
	constructor(
		protected readonly repository: InstrumentRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateInstrumentDto, manager?: EntityManager) {
		await InstrumentValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateInstrumentDto, manager?: EntityManager) {
		await InstrumentValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await InstrumentValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
