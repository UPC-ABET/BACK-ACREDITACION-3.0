import { Injectable } from '@nestjs/common';
import { PortfolioAccessConfigRepository } from '../core/portfolio-access-config.repository';
import { PortfolioAccessValidation } from '../core/portfolio-access.validation';
import { SetPortfolioAccessDto } from '../model/portfolio-access.dtos';

@Injectable()
export class PortfolioAccessService {
	constructor(private readonly accessConfigRepository: PortfolioAccessConfigRepository) {}

	async getMyAccess(userId: number, canManageAccess: boolean) {
		if (canManageAccess) {
			return { fullAccess: true, allowedPrefixes: [], canManageAccess: true };
		}

		const config = await this.accessConfigRepository.findByUserId(userId);

		return {
			fullAccess: config?.fullAccess ?? false,
			allowedPrefixes: config?.allowedPrefixes ?? [],
			canManageAccess: false,
		};
	}

	async getUsers(search?: string) {
		return this.accessConfigRepository.findUsersWithAccess(search);
	}

	async getUserAccess(userId: number) {
		await PortfolioAccessValidation.validateUserExists(this.accessConfigRepository, userId);

		const config = await this.accessConfigRepository.findByUserId(userId);

		return {
			fullAccess: config?.fullAccess ?? false,
			allowedPrefixes: config?.allowedPrefixes ?? [],
		};
	}

	async updateUserAccess(userId: number, dto: SetPortfolioAccessDto) {
		await PortfolioAccessValidation.validateUserExists(this.accessConfigRepository, userId);

		const config = await this.accessConfigRepository.upsertForUser(
			userId,
			dto.fullAccess,
			dto.allowedPrefixes,
		);

		return {
			fullAccess: config.fullAccess,
			allowedPrefixes: config.allowedPrefixes,
		};
	}
}
