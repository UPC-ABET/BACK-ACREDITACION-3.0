import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { UserEntity } from '../model/users.entity';

export class UserRepository extends BaseRepository<UserEntity> {
	constructor(
		@InjectRepository(UserEntity)
		repository: Repository<UserEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findForLogin(email: string): Promise<UserEntity | null> {
		return await this.repository
			.createQueryBuilder('user')
			.addSelect('user.password')
			.where('LOWER(user.email) = LOWER(:email)', { email })
			.andWhere('user.is_active = :active', { active: true })
			.getOne();
	}

	async findActiveByEmail(email: string): Promise<UserEntity | null> {
		return await this.repository
			.createQueryBuilder('user')
			.where('LOWER(user.email) = LOWER(:email)', { email })
			.andWhere('user.is_active = :active', { active: true })
			.getOne();
	}

	async findMaintenancePage(
		search: string | undefined,
		unlinkedOnly: boolean,
		skip: number,
		take: number,
	): Promise<[UserEntity[], number]> {
		const qb = this.repository.createQueryBuilder('user');

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			qb.andWhere(
				`(user.firstName ILIKE :term OR user.lastName ILIKE :term OR user.email ILIKE :term
					OR EXISTS (
						SELECT 1
						FROM organization.staff s
						JOIN academic.professors p ON p.staff_id = s.id
						WHERE s.user_id = user.id AND p.code ILIKE :term
					))`,
				{ term },
			);
		}

		if (unlinkedOnly) {
			qb.andWhere('NOT EXISTS (SELECT 1 FROM organization.staff s WHERE s.user_id = user.id)');
		}

		return await qb
			.orderBy('user.lastName', 'ASC')
			.addOrderBy('user.firstName', 'ASC')
			.addOrderBy('user.id', 'ASC')
			.skip(skip)
			.take(take)
			.getManyAndCount();
	}
}
