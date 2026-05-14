import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { AcademicPeriodRepository } from '../core/academic-periods.repository';
import { AcademicPeriodValidation } from '../core/academic-periods.validation';

import { CreateAcademicPeriodDto, UpdateAcademicPeriodDto } from '../model/academic-periods.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class AcademicPeriodService extends BaseService<AcademicPeriodRepository> {
	constructor(
		protected readonly repository: AcademicPeriodRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateAcademicPeriodDto, manager?: EntityManager) {
		await AcademicPeriodValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateAcademicPeriodDto, manager?: EntityManager) {
		await AcademicPeriodValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await AcademicPeriodValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
