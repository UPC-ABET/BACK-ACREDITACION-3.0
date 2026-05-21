import { EntityManager, FindOneOptions, IsNull, DataSource, Repository, QueryRunner, FindOperator } from 'typeorm';
import { IBaseRepository } from './ibase.repository';

export abstract class BaseRepostitory implements IBaseRepository {
	protected entity: any;

	constructor(
		entity: any,
		protected readonly dataSource: DataSource,
	) {
		this.entity = entity;
	}

	protected async getRepository(manager?: EntityManager): Promise<{ repository: Repository<any>; queryRunner: QueryRunner }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		const repository = manager ? manager.getRepository(this.entity.target) : queryRunner.manager.getRepository(this.entity.target);
		return { repository, queryRunner };
	}

	public async save(data: any, manager?: EntityManager): Promise<any> {
		const { repository, queryRunner } = await this.getRepository(manager);
		try {
			return await repository.save(data);
		} finally {
			await queryRunner.release();
		}
	}

	public async create(data: any, manager?: EntityManager): Promise<any> {
		const { repository, queryRunner } = await this.getRepository(manager);
		try {
			const entity = repository.create(data);
			return await repository.save(entity);
		} finally {
			await queryRunner.release();
		}
	}

	public async update(id: number, newEntity: any, manager?: EntityManager) {
		const { repository, queryRunner } = await this.getRepository(manager);

		try {
			const entity = await repository.findOne({ where: { id } });

			if (!entity) {
				throw new Error(`No se encontró la entidad con ID: ${id}`);
			}

			Object.assign(entity, newEntity);

			return await repository.save(entity);
		} finally {
			await queryRunner.release();
		}
	}

	public async remove(id: any, manager?: EntityManager) {
		const { repository, queryRunner } = await this.getRepository(manager);

		try {
			const entity = await repository.findOne({ where: { id } });
			return await repository.remove(entity);
		} finally {
			await queryRunner.release();
		}
	}

	public async findAll(relations?: string[]) {
		const { repository, queryRunner } = await this.getRepository();

		try {
			const allRelations = repository.metadata.relations.map((r) => r.propertyName);

			return await repository.find({
				relations: relations?.length ? relations : allRelations,
			});
		} finally {
			await queryRunner.release();
		}
	}

	public async findByCondition(options: FindOneOptions, relations?: string[]) {
		const { repository, queryRunner } = await this.getRepository();

		try {
			if (relations?.length) {
				options.relations = relations;
			} else {
				options.relations = repository.metadata.relations.map((r) => r.propertyName);
			}

			if (options?.where) {
				options.where = this.transformNullToIsNull(options.where);
			}

			return await repository.find(options);
		} finally {
			await queryRunner.release();
		}
	}

	public async findOneById(id: any, relations?: string[]) {
		const { repository, queryRunner } = await this.getRepository();

		try {
			return await repository.findOne({
				where: { id },
				relations: relations?.length ? relations : repository.metadata.relations.map((r) => r.propertyName),
			});
		} finally {
			await queryRunner.release();
		}
	}

	public async findOneByCondition(options: FindOneOptions) {
		const { repository, queryRunner } = await this.getRepository();

		try {
			if (!options.relations) {
				options.relations = repository.metadata.relations.map((r) => r.propertyName);
			}

			if (options?.where) {
				options.where = this.transformNullToIsNull(options.where);
			}

			return await repository.findOne(options);
		} finally {
			await queryRunner.release();
		}
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
