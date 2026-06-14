import { HttpException, HttpStatus } from '@nestjs/common';
import { PortfolioAccessConfigRepository } from './portfolio-access-config.repository';
import { portfolioAccessValidationStrings } from '../config/strings/portfolio-access.validation';

export class PortfolioAccessValidation {
	static async validateUserExists(
		repo: PortfolioAccessConfigRepository,
		userId: number,
	): Promise<void> {
		const exists = await repo.userExistsActive(userId);

		if (!exists) {
			throw new HttpException(
				{ message: portfolioAccessValidationStrings.error.userNotFound },
				HttpStatus.NOT_FOUND,
			);
		}
	}
}
