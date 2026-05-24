import {
	DataSource,
	EntityManager,
	FindManyOptions,
	FindOneOptions,
	FindOperator,
	IsNull,
	Repository,
} from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { IBaseRepository } from './ibase.repository';
import { sharedStrings } from '../shared/strings/shared.strings';

export abstract class BaseRepostitory implements IBaseRepository {
	protected readonly repository: Repository<any>;

	constructor(
		repository: Repository<any>,
		protected readonly dataSource: DataSource,
	) {
		this.repository = repository;
	}

	public async save(data: any, manager?: EntityManager): Promise<any> {
		return await this.resolveRepository(manager).save(data);
	}

	public async create(data: any, manager?: EntityManager): Promise<any> {
		const repository = this.resolveRepository(manager);
		const entity = repository.create(data);
		return await repository.save(entity);
	}

	public async update(id: number, newEntity: any, manager?: EntityManager) {
		const repository = this.resolveRepository(manager);
		const entity = await repository.findOne({ where: { id } });

		if (!entity) {
			throw new NotFoundException(sharedStrings.error.notFound);
		}

		Object.assign(entity, newEntity);

		return await repository.save(entity);
	}

	public async remove(id: any, manager?: EntityManager) {
		const repository = this.resolveRepository(manager);
		const entity = await repository.findOne({ where: { id } });

		if (!entity) {
			throw new NotFoundException(sharedStrings.error.notFound);
		}

		return await repository.remove(entity);
	}

	public async findAll(options: FindManyOptions = {}) {
		return await this.repository.find(this.normalizeFindManyOptions(options));
	}

	public async findByCondition(options: FindOneOptions, relations?: string[]) {
		return await this.repository.find(this.normalizeFindManyOptions(options, relations));
	}

	public async findOneById(id: any, relations?: string[]) {
		return await this.repository.findOne(
			this.normalizeFindOneOptions({ where: { id } }, relations),
		);
	}

	public async findOneByCondition(options: FindOneOptions, relations?: string[]) {
		return await this.repository.findOne(this.normalizeFindOneOptions(options, relations));
	}

	private resolveRepository(manager?: EntityManager): Repository<any> {
		return manager ? manager.getRepository(this.repository.target) : this.repository;
	}

	private normalizeFindManyOptions(
		options: FindManyOptions = {},
		relations?: string[],
	): FindManyOptions {
		const normalized = { ...options };

		if (relations?.length) {
			normalized.relations = relations;
		}

		if (normalized.where) {
			normalized.where = this.transformNullToIsNull(normalized.where);
		}

		return normalized;
	}

	private normalizeFindOneOptions(options: FindOneOptions, relations?: string[]): FindOneOptions {
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
