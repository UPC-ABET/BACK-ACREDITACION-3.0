import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { CampusRepository } from '../core/campuses.repository';
import { CampusValidation } from '../core/campuses.validation';

import { CreateCampusDto, UpdateCampusDto } from '../model/campuses.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class CampusService extends BaseService<CampusRepository> {
	constructor(
		protected readonly repository: CampusRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateCampusDto, manager?: EntityManager) {
		await CampusValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateCampusDto, manager?: EntityManager) {
		await CampusValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await CampusValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
