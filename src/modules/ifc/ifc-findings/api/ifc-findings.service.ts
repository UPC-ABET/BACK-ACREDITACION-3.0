import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { IfcFindingRepository } from '../core/ifc-findings.repository';
import { IfcFindingValidation } from '../core/ifc-findings.validation';

import { CreateIfcFindingDto, UpdateIfcFindingDto } from '../model/ifc-findings.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class IfcFindingService extends BaseService<IfcFindingRepository> {
	constructor(
		protected readonly repository: IfcFindingRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateIfcFindingDto, manager?: EntityManager) {
		await IfcFindingValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateIfcFindingDto, manager?: EntityManager) {
		await IfcFindingValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await IfcFindingValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
