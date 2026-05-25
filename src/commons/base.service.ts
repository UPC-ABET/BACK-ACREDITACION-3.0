import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { EntityManager, FindManyOptions, FindOneOptions } from 'typeorm';

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
		return await this.baseRepository.findAll(options);
	}
	async getById(id: number, options?: FindOneOptions) {
		return await this.baseRepository.findOneById(id, options?.relations as string[]);
	}
	async getByCode(code: string, options?: FindOneOptions) {
		return await this.baseRepository.findOneByCondition({
			...options,
			where: { code },
		} as any);
	}
	async getByFilters(filters: Record<string, any>, options?: FindOneOptions) {
		return await this.baseRepository.findByCondition({
			...options,
			where: filters,
		} as any);
	}
}
