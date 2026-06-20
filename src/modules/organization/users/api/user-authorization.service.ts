import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import {
	AuthorizationPermission,
	AuthorizationProfile,
	AuthorizationRole,
} from 'src/modules/auth/model/authorization.types';
import { usersValidationStrings } from '../config/strings/users.validation';

@Injectable()
export class UserAuthorizationService {
	constructor(
		private readonly dataSource: DataSource,
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
	) {}

	async buildAuthorizationProfile(userId: number): Promise<AuthorizationProfile> {
		const key = `authz:${userId}`;
		const cached = await this.cache.get<AuthorizationProfile>(key);
		if (cached) return cached;

		const profile = await this.computeAuthorizationProfile(userId);
		await this.cache.set(key, profile, 30_000);
		return profile;
	}

	private async computeAuthorizationProfile(userId: number): Promise<AuthorizationProfile> {
		await this.ensureActiveUser(userId);

		const roles = await this.findUserRoles(userId);
		if (roles.length === 0) {
			throw new UnauthorizedException(usersValidationStrings.error.noRolesAssigned);
		}

		const permissions = await this.findRolesPermissions(roles.map((role) => role.id));

		return { roles, permissions };
	}

	private async ensureActiveUser(userId: number): Promise<void> {
		const users = await this.dataSource.query(
			`
				SELECT u.id, u.is_active AS "isActive"
				FROM organization.users u
				WHERE u.id = $1
				LIMIT 1;
			`,
			[userId],
		);

		const user = users?.[0];
		if (!user || !this.toBoolean(user.isActive)) {
			throw new UnauthorizedException(usersValidationStrings.error.inactiveOrNotFound);
		}
	}

	private async findUserRoles(userId: number): Promise<AuthorizationRole[]> {
		const rows = await this.dataSource.query(
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

		return rows.map((row) => ({
			id: Number(row.id),
			code: String(row.code ?? ''),
			name: this.parseJsonObject(row.name),
		}));
	}

	private async findRolesPermissions(roleIds: number[]): Promise<AuthorizationPermission[]> {
		const rows = await this.dataSource.query(
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

		return rows.map((row) => ({
			id: Number(row.id),
			code: String(row.code ?? ''),
			module: String(row.module ?? ''),
			route: String(row.route ?? ''),
			permissions: Array.isArray(row.permissions)
				? row.permissions.map((permission) => String(permission))
				: [],
		}));
	}

	private parseJsonObject(value: unknown): { en?: string; es?: string } {
		if (!value) {
			return {};
		}
		if (typeof value === 'object') {
			return value as { en?: string; es?: string };
		}
		if (typeof value === 'string') {
			try {
				return JSON.parse(value) as { en?: string; es?: string };
			} catch {
				return { en: value };
			}
		}
		return {};
	}

	private toBoolean(value: unknown): boolean {
		if (typeof value === 'boolean') return value;
		if (typeof value === 'number') return value === 1;
		if (typeof value === 'string') return ['1', 'true', 't'].includes(value.toLowerCase());
		return false;
	}
}
