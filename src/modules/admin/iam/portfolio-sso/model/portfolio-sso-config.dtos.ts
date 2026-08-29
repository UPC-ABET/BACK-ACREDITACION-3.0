import { IsString, IsUrl, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const API_KEY_MIN_LENGTH = 32;

export class UpsertPortfolioSsoConfigDto {
	@IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
	@ApiProperty({ example: 'https://portfolio.example.edu', required: true })
	baseUrl: string;

	@IsString()
	@MinLength(API_KEY_MIN_LENGTH)
	@ApiProperty({
		description: `Shared secret with PORTFOLIO-AUDIT, at least ${API_KEY_MIN_LENGTH} characters.`,
		required: true,
	})
	apiKey: string;
}

/** Never carries plaintext or ciphertext `apiKey` — only whether one is configured. */
export class PortfolioSsoConfigSummaryDto {
	@ApiProperty({ example: 'https://portfolio.example.edu' })
	baseUrl: string;

	@ApiProperty({ description: 'Whether a shared secret has been configured.' })
	configured: boolean;

	@ApiProperty({ nullable: true })
	updatedAt: Date | null;
}

export class PortfolioSsoLinkResponseDto {
	@ApiProperty({ description: 'Freshly-signed SSO link into PORTFOLIO-AUDIT.' })
	url: string;
}
