import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EncryptService } from 'src/libs/encrypt.service';
import { UserRepository } from 'src/modules/organization/users/core/users.repository';
import { NotFoundError } from 'src/commons/domain-error';
import { PortfolioSsoConfigRepository } from '../core/portfolio-sso-config.repository';
import { PortfolioSsoConfigValidation } from '../core/portfolio-sso-config.validation';
import { buildPortfolioSsoToken } from '../core/portfolio-sso-token.functions';
import { portfolioSsoValidationStrings } from '../config/strings/portfolio-sso.validation';
import {
	PortfolioSsoConfigSummaryDto,
	PortfolioSsoLinkResponseDto,
	UpsertPortfolioSsoConfigDto,
} from '../model/portfolio-sso-config.dtos';

@Injectable()
export class PortfolioSsoService extends BaseService<PortfolioSsoConfigRepository> {
	constructor(
		protected readonly repository: PortfolioSsoConfigRepository,
		private readonly userRepository: UserRepository,
		private readonly encryptService: EncryptService,
	) {
		super(repository);
	}

	async getConfigSummary(): Promise<PortfolioSsoConfigSummaryDto> {
		const config = await this.repository.getConfig();

		return {
			baseUrl: config?.baseUrl ?? '',
			configured: config !== null,
			updatedAt: config?.updatedAt ?? null,
		};
	}

	async upsertConfig(dto: UpsertPortfolioSsoConfigDto): Promise<PortfolioSsoConfigSummaryDto> {
		const { baseUrl } = PortfolioSsoConfigValidation.validateUpsert(dto);
		const apiKeyEncrypted = this.encryptService.encrypt(dto.apiKey);

		const config = await this.repository.upsertSingleton(baseUrl, apiKeyEncrypted);

		return {
			baseUrl: config.baseUrl,
			configured: true,
			updatedAt: config.updatedAt,
		};
	}

	async buildLoginLink(userId: number): Promise<PortfolioSsoLinkResponseDto> {
		const config = await this.repository.getConfigWithSecret();
		PortfolioSsoConfigValidation.validateConfigured(config);

		const user = await this.userRepository.findOneById(userId);
		if (!user) {
			throw new NotFoundError({
				message: portfolioSsoValidationStrings.result.linkFailed,
				errors: [portfolioSsoValidationStrings.error.userNotFound],
			});
		}

		const apiKey = this.encryptService.decrypt(config.apiKeyEncrypted);
		const payload = {
			username: user.email,
			email: user.email,
			fullName: `${user.firstName} ${user.lastName}`.trim(),
			firstName: user.firstName,
			lastName: user.lastName,
			documentCode: user.documentCode ?? undefined,
			phone: user.phone ?? undefined,
			issuedAt: Date.now(),
		};

		const token = buildPortfolioSsoToken(payload, apiKey);

		return { url: `${config.baseUrl}/auth/externo?token=${token}` };
	}
}
