import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { UserEntity } from '../model/users.entity';

export interface LinkedTeacherRow {
	userId: number;
	staffId: number;
	code: string | null;
	firstName: string;
	lastName: string;
}

export interface UserDeleteBlockerRefs {
	hasStaff: boolean;
	hasUploads: boolean;
	hasNotifications: boolean;
}

export interface UserActiveFlagRow {
	id: number;
	isActive: unknown;
}

export interface UserRoleRow {
	id: number;
	code: unknown;
	name: unknown;
}

export interface RolePermissionRow {
	id: number;
	code: unknown;
	module: unknown;
	route: unknown;
	permissions: unknown;
}

export class UserRepository extends BaseRepository<UserEntity> {
	constructor(
		@InjectRepository(UserEntity)
		repository: Repository<UserEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async releaseStaffFromUser(userId: number, manager?: EntityManager): Promise<void> {
		const m = manager ?? this.dataSource.manager;
		await m.query(
			`UPDATE organization.staff SET user_id = NULL, updated_at = NOW() WHERE user_id = $1`,
			[userId],
		);
	}

	async findStaffId(staffId: number, manager?: EntityManager): Promise<number | null> {
		const m = manager ?? this.dataSource.manager;
		const found: Array<{ id: number }> = await m.query(
			`SELECT id FROM organization.staff WHERE id = $1 LIMIT 1`,
			[staffId],
		);
		return found.length > 0 ? found[0].id : null;
	}

	async linkStaffToUser(userId: number, staffId: number, manager?: EntityManager): Promise<void> {
		const m = manager ?? this.dataSource.manager;
		await m.query(`UPDATE organization.staff SET user_id = $1, updated_at = NOW() WHERE id = $2`, [
			userId,
			staffId,
		]);
	}

	async findLinkedTeachers(userIds: number[]): Promise<LinkedTeacherRow[]> {
		return await this.dataSource.query(
			`SELECT s.user_id AS "userId", s.id AS "staffId", p.code, s.first_name AS "firstName", s.last_name AS "lastName"
			 FROM organization.staff s
			 LEFT JOIN academic.professors p ON p.staff_id = s.id
			 WHERE s.user_id = ANY($1)`,
			[userIds],
		);
	}

	async findDeleteBlockerRefs(
		userId: number,
		manager: EntityManager,
	): Promise<UserDeleteBlockerRefs> {
		const [refs]: UserDeleteBlockerRefs[] = await manager.query(
			`SELECT
				EXISTS(SELECT 1 FROM organization.staff WHERE user_id = $1) AS "hasStaff",
				EXISTS(SELECT 1 FROM audit.upload_logs WHERE user_id = $1) AS "hasUploads",
				EXISTS(SELECT 1 FROM core.notification_logs WHERE notifier_user_id = $1) AS "hasNotifications"`,
			[userId],
		);
		return refs;
	}

	async deleteUserRoles(userId: number, manager: EntityManager): Promise<void> {
		await manager.query(`DELETE FROM core.user_roles WHERE user_id = $1`, [userId]);
	}

	async runInTransaction<T>(run: (manager: EntityManager) => Promise<T>): Promise<T> {
		return await this.dataSource.transaction(run);
	}

	async findActiveFlag(userId: number): Promise<UserActiveFlagRow | null> {
		const rows: UserActiveFlagRow[] = await this.dataSource.query(
			`
				SELECT u.id, u.is_active AS "isActive"
				FROM organization.users u
				WHERE u.id = $1
				LIMIT 1;
			`,
			[userId],
		);
		return rows?.[0] ?? null;
	}

	async findAuthorizationRoles(userId: number): Promise<UserRoleRow[]> {
		return await this.dataSource.query(
			`
				SELECT DISTINCT r.id, r.code, r.name
				FROM core.user_roles ur
				INNER JOIN core.roles r ON r.id = ur.role_id
				WHERE ur.user_id = $1
				  AND ur.is_active = TRUE
				  AND r.is_active = TRUE
				ORDER BY r.id ASC;
			`,
			[userId],
		);
	}

	async findAuthorizationPermissions(roleIds: number[]): Promise<RolePermissionRow[]> {
		return await this.dataSource.query(
			`
				SELECT
				  MIN(rmp.id) AS id,
				  mt.code AS code,
				  COALESCE(mt.extra->>'module', mt.name->>'en', '') AS module,
				  COALESCE(mt.extra->>'route', '') AS route,
				  COALESCE(array_agg(DISTINCT (pt.name->>'en')) FILTER (WHERE pt.name->>'en' IS NOT NULL), ARRAY[]::text[]) AS permissions
				FROM core.role_module_permissions rmp
				INNER JOIN core.types mt ON mt.id = rmp.module_type_id
				INNER JOIN core.types pt ON pt.id = rmp.permission_type_id
				WHERE rmp.role_id = ANY($1)
				  AND rmp.is_active = TRUE
				GROUP BY mt.id, mt.code, mt.extra, mt.name
				ORDER BY MIN(rmp.id) ASC;
			`,
			[roleIds],
		);
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

	async findDisplayNamesByIds(userIds: number[]): Promise<Map<number, string>> {
		if (userIds.length === 0) return new Map();
		const users = await this.findByCondition({
			where: { id: In(userIds) },
			select: ['id', 'firstName', 'lastName'],
		});
		return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
	}
}
