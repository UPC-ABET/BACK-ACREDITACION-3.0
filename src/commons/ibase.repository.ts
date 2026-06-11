import { DeepPartial, FindManyOptions, FindOneOptions } from 'typeorm';

import { BaseEntity } from './base.entity';

export interface IBaseRepository<E extends BaseEntity = BaseEntity> {
	save(data: DeepPartial<E>): Promise<E>;
	create(data: DeepPartial<E>): Promise<E>;
	update(id: number, newEntity: DeepPartial<E>): Promise<E | null>;
	remove(id: number): Promise<E>;

	findAll(options?: FindManyOptions<E>): Promise<E[]>;
	findByCondition(options: FindManyOptions<E>, relations?: string[]): Promise<E[]>;
	findOneById(id: number, relations?: string[]): Promise<E | null>;
	findOneByCondition(options: FindOneOptions<E>, relations?: string[]): Promise<E | null>;
}
