import { IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IssueIntegrationKeyDto {
	@IsInt()
	@IsPositive()
	@ApiProperty({ example: 1, required: true })
	apiTokenId: number;
}

/** The only response shape carrying the plaintext `key` — issuance/rotation only, exactly once. */
export class IssuedIntegrationKeyDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	apiTokenId: number;

	@ApiProperty()
	issuedByUserId: number;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;

	@ApiProperty({
		description: 'Plaintext key material (64 hex chars = 32 bytes), returned exactly once.',
	})
	key: string;
}

export class IntegrationKeySummaryDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	apiTokenId: number;

	@ApiProperty()
	issuedByUserId: number;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;
}
