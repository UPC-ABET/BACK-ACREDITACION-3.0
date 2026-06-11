import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { TypeRepository } from '../core/types.repository';
import { TypeValidation } from '../core/types.validation';
import { typesValidationStrings } from '../config/strings/types.validation';

import { CreateTypeDto, UpdateTypeDto } from '../model/types.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TypeService extends BaseService<TypeRepository> {
	constructor(
		protected readonly repository: TypeRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateTypeDto, manager?: EntityManager) {
		const code = await this.repository.generateNextCode(dto.typeGroupId);
		if (!code) {
			throw new HttpException(
				{ message: typesValidationStrings.error.groupNotFound },
				HttpStatus.BAD_REQUEST,
			);
		}

		const payload = { ...dto, code };
		await TypeValidation.validateCreate(this.repository, payload);
		return await super.create(payload, manager);
	}

	async update(id: number, dto: UpdateTypeDto, manager?: EntityManager) {
		await TypeValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await TypeValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async findByGroupCode(groupCode: string) {
		return await this.dataSource.query(
			`SELECT t.id::int AS id, t.code, t.name, t.description
			 FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1 AND t.is_active = true
			 ORDER BY t.code`,
			[groupCode],
		);
	}
}
