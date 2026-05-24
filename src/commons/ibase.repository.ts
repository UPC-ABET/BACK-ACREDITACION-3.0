import { FindManyOptions, FindOneOptions } from 'typeorm';

export interface IBaseRepository {
	save(data: any): Promise<any>;
	create(data: any): Promise<any>;
	update(id: any, newEntity: any): Promise<any>;
	remove(data: any): Promise<any>;

	findAll(options?: FindManyOptions): Promise<any[]>;
	findByCondition(options: FindOneOptions, relations?: string[]): Promise<any[]>;
	findOneById(id: any, relations?: string[]): Promise<any>;
	findOneByCondition(options: FindOneOptions, relations?: string[]): Promise<any>;
}
