import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { SchoolRepository } from '../core/schools.repository';
import { SchoolValidation } from '../core/schools.validation';

import { CreateSchoolDto, UpdateSchoolDto } from '../model/schools.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class SchoolService extends BaseService<SchoolRepository> {
	constructor(protected readonly repository: SchoolRepository) {
		super(repository);
	}

	async findActiveByCode(code: string) {
		return await this.baseRepository.findOneByCondition({
			where: { code, isActive: true },
		});
	}

	async create(dto: CreateSchoolDto, manager?: EntityManager) {
		await SchoolValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateSchoolDto, manager?: EntityManager) {
		await SchoolValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await SchoolValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
