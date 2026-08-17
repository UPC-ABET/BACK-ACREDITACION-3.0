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
import { snakeizeKeys } from '../libs/case.functions';

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

	public getJsonbColumnNames(): string[] {
		return this.repository.metadata.columns
			.filter((column) => String(column.type) === 'jsonb' || String(column.type) === 'json')
			.map((column) => column.propertyName);
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

		// `repository.update()` builds a raw UPDATE and bypasses column transformers, so snake-ize
		// JSONB content here to keep the DB's snake_case convention (mirrors JsonColumn's `to`).
		const result = await repository.update(
			id,
			this.snakeizeJsonbColumns(partial) as Parameters<Repository<E>['update']>[1],
		);
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

	/** Protected rather than private so concrete repositories writing their own
	 *  multi-row inserts honour a caller's transaction the same way the CRUD methods
	 *  above do, instead of each re-deriving `manager.getRepository(...)`. */
	protected resolveRepository(manager?: EntityManager): Repository<E> {
		return manager ? manager.getRepository(this.repository.target) : this.repository;
	}

	private snakeizeJsonbColumns<T extends Record<string, any>>(data: T): T {
		if (data === null || typeof data !== 'object') return data;

		const jsonbColumns = this.getJsonbColumnNames();
		if (jsonbColumns.length === 0) return data;

		const clone: Record<string, any> = { ...data };
		for (const column of jsonbColumns) {
			if (clone[column] !== null && clone[column] !== undefined) {
				clone[column] = snakeizeKeys(clone[column]);
			}
		}
		return clone as T;
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
