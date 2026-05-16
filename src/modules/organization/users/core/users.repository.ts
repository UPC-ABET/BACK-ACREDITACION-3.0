import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { UserEntity } from '../model/users.entity';

export class UserRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(UserEntity)
		repository: Repository<UserEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findForLogin(email: string): Promise<UserEntity | null> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository.createQueryBuilder('user').addSelect('user.password').where('user.email = :email', { email }).andWhere('user.is_active = :active', { active: 1 }).getOne();
		} finally {
			await queryRunner.release();
		}
	}
}
