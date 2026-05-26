import {
	DataSource,
	DeepPartial,
	EntityManager,
	FindManyOptions,
	FindOneOptions,
	FindOperator,
	FindOptionsWhere,
	IsNull,
	Repository,
} from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { IBaseRepository } from './ibase.repository';
import { BaseEntity } from './base.entity';
import { sharedStrings } from '../shared/strings/shared.strings';

export abstract class BaseRepository<
	E extends BaseEntity = BaseEntity,
> implements IBaseRepository<E> {
	protected readonly repository: Repository<E>;

	constructor(
		repository: Repository<E>,
		protected readonly dataSource: DataSource,
	) {
		this.repository = repository;
	}

	public async save(data: DeepPartial<E>, manager?: EntityManager): Promise<E> {
		return await this.resolveRepository(manager).save(data);
	}

	public async create(data: DeepPartial<E>, manager?: EntityManager): Promise<E> {
		const repository = this.resolveRepository(manager);
		const entity = repository.create(data);
		return await repository.save(entity);
	}

	public async update(id: number, partial: DeepPartial<E>, manager?: EntityManager) {
		const repository = this.resolveRepository(manager);

		const result = await repository.update(id, partial as Parameters<Repository<E>['update']>[1]);
		if (result.affected === 0) {
			throw new NotFoundException(sharedStrings.error.notFound);
		}

		return await repository.findOne({ where: { id } as FindOptionsWhere<E> });
	}

	public async remove(id: number, manager?: EntityManager) {
		const repository = this.resolveRepository(manager);
		const entity = await repository.findOne({ where: { id } as FindOptionsWhere<E> });

		if (!entity) {
			throw new NotFoundException(sharedStrings.error.notFound);
		}

		return await repository.remove(entity);
	}

	public async findAll(options: FindManyOptions<E> = {}) {
		return await this.repository.find(this.normalizeFindManyOptions(options));
	}

	public async findByCondition(options: FindManyOptions<E>, relations?: string[]) {
		return await this.repository.find(this.normalizeFindManyOptions(options, relations));
	}

	public async findOneById(id: number, relations?: string[]) {
		return await this.repository.findOne(
			this.normalizeFindOneOptions({ where: { id } as FindOptionsWhere<E> }, relations),
		);
	}

	public async findOneByCondition(options: FindOneOptions<E>, relations?: string[]) {
		return await this.repository.findOne(this.normalizeFindOneOptions(options, relations));
	}

	private resolveRepository(manager?: EntityManager): Repository<E> {
		return manager ? manager.getRepository(this.repository.target) : this.repository;
	}

	private normalizeFindManyOptions(
		options: FindManyOptions<E> = {},
		relations?: string[],
	): FindManyOptions<E> {
		const normalized = { ...options };

		if (relations?.length) {
			normalized.relations = relations;
		}

		if (normalized.where) {
			normalized.where = this.transformNullToIsNull(normalized.where);
		}

		return normalized;
	}

	private normalizeFindOneOptions(
		options: FindOneOptions<E>,
		relations?: string[],
	): FindOneOptions<E> {
		const normalized = { ...options };

		if (relations?.length) {
			normalized.relations = relations;
		}

		if (normalized.where) {
			normalized.where = this.transformNullToIsNull(normalized.where);
		}

		return normalized;
	}

	public transformNullToIsNull(obj: any): any {
		if (Array.isArray(obj)) {
			return obj.map(this.transformNullToIsNull.bind(this));
		}

		if (obj instanceof FindOperator) {
			return obj;
		}

		if (obj !== null && typeof obj === 'object') {
			const newObj: any = {};

			for (const key in obj) {
				const value = obj[key];

				if (value instanceof FindOperator) {
					newObj[key] = value;
				} else if (value === null) {
					newObj[key] = IsNull();
				} else {
					newObj[key] = this.transformNullToIsNull(value);
				}
			}

			return newObj;
		}

		return obj;
	}
}
