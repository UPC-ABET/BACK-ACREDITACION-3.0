import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PortfolioAccessConfigEntity } from '../model/portfolio-access-config.entity';
import { PortfolioUserAccess } from '../model/portfolio-access.dtos';

const USER_RESULT_LIMIT = 100;

interface UserAccessRow {
	userId: number | string;
	fullName: string;
	email: string;
	fullAccess: boolean;
	allowedPrefixes: unknown;
}

@Injectable()
export class PortfolioAccessConfigRepository extends BaseRepository<PortfolioAccessConfigEntity> {
	constructor(
		@InjectRepository(PortfolioAccessConfigEntity)
		private readonly accessConfigRepo: Repository<PortfolioAccessConfigEntity>,
		dataSource: DataSource,
	) {
		super(accessConfigRepo, dataSource);
	}

	async findByUserId(userId: number): Promise<PortfolioAccessConfigEntity | null> {
		return this.accessConfigRepo.findOne({ where: { userId } });
	}

	async userExistsActive(userId: number): Promise<boolean> {
		const rows = await this.dataSource.query(
			`SELECT 1 FROM organization.users WHERE id = $1 AND is_active = true LIMIT 1`,
			[userId],
		);
		return rows.length > 0;
	}

	async findUsersWithAccess(search?: string): Promise<PortfolioUserAccess[]> {
		const searchClause = search
			? `AND (LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($1) OR LOWER(u.email) LIKE LOWER($1))`
			: '';

		const rows: UserAccessRow[] = await this.dataSource.query(
			`
			SELECT
				u.id                                       AS "userId",
				u.first_name || ' ' || u.last_name         AS "fullName",
				u.email                                    AS "email",
				COALESCE(ac.full_access, false)            AS "fullAccess",
				COALESCE(ac.allowed_prefixes, '[]'::jsonb) AS "allowedPrefixes"
			FROM organization.users u
			LEFT JOIN portfolio.access_config ac ON ac.user_id = u.id
			WHERE u.is_active = true
			${searchClause}
			ORDER BY u.first_name, u.last_name
			LIMIT ${USER_RESULT_LIMIT}
			`,
			search ? [`%${search}%`] : [],
		);

		return rows.map((row) => ({
			userId: Number(row.userId),
			fullName: String(row.fullName),
			email: String(row.email),
			fullAccess: Boolean(row.fullAccess),
			allowedPrefixes: Array.isArray(row.allowedPrefixes) ? (row.allowedPrefixes as string[]) : [],
		}));
	}

	async upsertForUser(
		userId: number,
		fullAccess: boolean,
		allowedPrefixes: string[],
	): Promise<PortfolioAccessConfigEntity> {
		const existing = await this.findByUserId(userId);

		return this.accessConfigRepo.save({
			...(existing ? { id: existing.id } : {}),
			userId,
			fullAccess,
			allowedPrefixes,
		});
	}
}
