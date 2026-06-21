import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
	AuthorizationPermission,
	AuthorizationProfile,
	AuthorizationRole,
} from 'src/modules/auth/model/authorization.types';
import { usersValidationStrings } from '../config/strings/users.validation';
import { UserRepository } from '../core/users.repository';

@Injectable()
export class UserAuthorizationService {
	constructor(
		private readonly userRepository: UserRepository,
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
		const user = await this.userRepository.findActiveFlag(userId);
		if (!user || !this.toBoolean(user.isActive)) {
			throw new UnauthorizedException(usersValidationStrings.error.inactiveOrNotFound);
		}
	}

	private async findUserRoles(userId: number): Promise<AuthorizationRole[]> {
		const rows = await this.userRepository.findAuthorizationRoles(userId);

		return rows.map((row) => ({
			id: Number(row.id),
			code: String(row.code ?? ''),
			name: this.parseJsonObject(row.name),
		}));
	}

	private async findRolesPermissions(roleIds: number[]): Promise<AuthorizationPermission[]> {
		const rows = await this.userRepository.findAuthorizationPermissions(roleIds);

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
