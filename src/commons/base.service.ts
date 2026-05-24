import { Injectable } from '@nestjs/common';
import { BaseRepostitory } from './base.repository';
import { BaseDto } from './base.dtos';
import { EntityManager, FindManyOptions, FindOneOptions } from 'typeorm';

@Injectable()
export class BaseService<T extends BaseRepostitory> {
	constructor(protected readonly baseRepository: T) {}

	async create(createDto: BaseDto, manager?: EntityManager): Promise<T> {
		return this.baseRepository.create(createDto, manager);
	}
	async update(id: any, updateDto: BaseDto, manager?: EntityManager) {
		return await this.baseRepository.update(id, updateDto, manager);
	}
	async delete(id: any, manager?: EntityManager) {
		return await this.baseRepository.remove(id, manager);
	}

	async getAll(options?: FindManyOptions<any>): Promise<T[]> {
		return await this.baseRepository.findAll(options);
	}
	async getById(id: any, options?: FindOneOptions<any>) {
		return await this.baseRepository.findOneById(id, options?.relations as string[]);
	}
	async getByCode(code: any, options?: FindOneOptions<any>) {
		return await this.baseRepository.findOneByCondition({ where: { code }, ...options });
	}
	async getByFilters(filters: any, options?: FindOneOptions<any>) {
		return await this.baseRepository.findByCondition({ where: filters, ...options });
	}
}
