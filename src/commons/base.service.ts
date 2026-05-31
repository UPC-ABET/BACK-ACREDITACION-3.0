import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { EntityManager, FindManyOptions, FindOneOptions } from 'typeorm';
import { camelizeKeys } from '../libs/case.functions';

@Injectable()
export class BaseService<R extends BaseRepository<any> = BaseRepository> {
	constructor(protected readonly baseRepository: R) {}

	async create(createDto: Record<string, any>, manager?: EntityManager) {
		return this.baseRepository.create(createDto, manager);
	}
	async update(id: number, updateDto: Record<string, any>, manager?: EntityManager) {
		return await this.baseRepository.update(id, updateDto, manager);
	}
	async delete(id: number, manager?: EntityManager) {
		return await this.baseRepository.remove(id, manager);
	}

	async getAll(options?: FindManyOptions) {
		return this.normalizeJsonbColumns(await this.baseRepository.findAll(options));
	}
	async getById(id: number, options?: FindOneOptions) {
		return this.normalizeJsonbColumns(
			await this.baseRepository.findOneById(id, options?.relations as string[]),
		);
	}
	async getByCode(code: string, options?: FindOneOptions) {
		return this.normalizeJsonbColumns(
			await this.baseRepository.findOneByCondition({
				...options,
				where: { code },
			} as any),
		);
	}
	async getByFilters(filters: Record<string, any>, options?: FindOneOptions) {
		return this.normalizeJsonbColumns(
			await this.baseRepository.findByCondition({
				...options,
				where: filters,
			} as any),
		);
	}

	protected normalizeJsonbColumns<T>(result: T): T {
		if (result === null || result === undefined) return result;

		const jsonbColumns = this.baseRepository.getJsonbColumnNames();
		if (jsonbColumns.length === 0) return result;

		const apply = (entity: any) => {
			if (entity === null || typeof entity !== 'object') return entity;
			for (const column of jsonbColumns) {
				if (entity[column] !== null && entity[column] !== undefined) {
					entity[column] = camelizeKeys(entity[column]);
				}
			}
			return entity;
		};

		return (Array.isArray(result) ? result.map(apply) : apply(result)) as T;
	}
}
