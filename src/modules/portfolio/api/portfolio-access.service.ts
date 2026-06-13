import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PortfolioAccessConfigRepository } from '../core/portfolio-access-config.repository';
import { portfolioAccessValidationStrings } from '../config/strings/portfolio-access.validation';
import { UpdatePortfolioAccessDto } from '../model/portfolio-access.dtos';

const strings = portfolioAccessValidationStrings;

@Injectable()
export class PortfolioAccessService {
	constructor(
		private readonly accessConfigRepository: PortfolioAccessConfigRepository,
		private readonly dataSource: DataSource,
	) {}

	async getMyAccess(userId: number, activeRoleCode: string) {
		const isAdmin = activeRoleCode.toUpperCase() === 'ADMIN';

		if (isAdmin) {
			return { fullAccess: true, allowedPrefixes: [], canManageAccess: true };
		}

		const config = await this.accessConfigRepository.findByUserId(userId);

		return {
			fullAccess: config?.fullAccess ?? false,
			allowedPrefixes: config?.allowedPrefixes ?? [],
			canManageAccess: false,
		};
	}

	async getUsers(activeRoleCode: string, search?: string) {
		this.validateAdmin(activeRoleCode);

		const searchClause = search
			? `AND (LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($1) OR LOWER(u.email) LIKE LOWER($1))`
			: '';

		const rows = await this.dataSource.query(
			`
			SELECT
				u.id                                             AS "userId",
				u.first_name || ' ' || u.last_name              AS "fullName",
				u.email,
				COALESCE(ac.full_access, false)                  AS "fullAccess",
				COALESCE(ac.allowed_prefixes, '[]'::jsonb)       AS "allowedPrefixes"
			FROM organization.users u
			LEFT JOIN portfolio.access_config ac ON ac.user_id = u.id
			WHERE u.is_active = true
			${searchClause}
			ORDER BY u.first_name, u.last_name
			LIMIT 100
			`,
			search ? [`%${search}%`] : [],
		);

		return rows.map((row) => ({
			userId: Number(row.userId),
			fullName: String(row.fullName),
			email: String(row.email),
			fullAccess: Boolean(row.fullAccess),
			allowedPrefixes: Array.isArray(row.allowedPrefixes) ? row.allowedPrefixes : [],
		}));
	}

	async getUserAccess(userId: number, activeRoleCode: string) {
		this.validateAdmin(activeRoleCode);

		const userExists = await this.dataSource.query(
			`SELECT id FROM organization.users WHERE id = $1 AND is_active = true LIMIT 1`,
			[userId],
		);

		if (!userExists?.length) {
			throw new NotFoundException(strings.error.userNotFound);
		}

		const config = await this.accessConfigRepository.findByUserId(userId);

		return {
			fullAccess: config?.fullAccess ?? false,
			allowedPrefixes: config?.allowedPrefixes ?? [],
		};
	}

	async updateUserAccess(userId: number, dto: UpdatePortfolioAccessDto, activeRoleCode: string) {
		this.validateAdmin(activeRoleCode);

		const userExists = await this.dataSource.query(
			`SELECT id FROM organization.users WHERE id = $1 AND is_active = true LIMIT 1`,
			[userId],
		);

		if (!userExists?.length) {
			throw new NotFoundException(strings.error.userNotFound);
		}

		await this.accessConfigRepository.upsertForUser(userId, dto.fullAccess, dto.allowedPrefixes);

		return {
			fullAccess: dto.fullAccess,
			allowedPrefixes: dto.allowedPrefixes,
		};
	}

	private validateAdmin(activeRoleCode: string): void {
		if (activeRoleCode.toUpperCase() !== 'ADMIN') {
			throw new ForbiddenException(strings.error.accessDenied);
		}
	}
}
