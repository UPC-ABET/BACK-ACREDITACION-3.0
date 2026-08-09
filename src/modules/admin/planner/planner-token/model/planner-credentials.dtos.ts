import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { PlannerSessionStatus } from './planner-session.types';

export class SavePlannerCredentialsDto {
	@IsString()
	@Length(1, 100)
	@ApiProperty({ example: 'planner-operator', required: true })
	username: string;

	@IsString()
	@Length(1, 200)
	@ApiProperty({
		example: 'the u-planner account password',
		required: true,
		description: 'Plaintext. Verified against u-planner before it is encrypted and stored.',
	})
	password: string;
}

// `type` is passed explicitly on every nullable field below. Swagger reflects the emitted design
// type, and a `string | null` union emits `Object` — which renders as `"type": "object"` in the
// spec and misdescribes the field to the frontend.

/** Deliberately has no password field of any kind — not the plaintext, not the ciphertext. */
export class PlannerCredentialsResponseDto {
	@ApiProperty({ type: String, example: 'planner-operator', nullable: true })
	username: string | null;

	@ApiProperty({ type: Boolean, example: true })
	configured: boolean;

	@ApiProperty({
		type: String,
		format: 'date-time',
		example: '2026-08-08T02:10:35.000Z',
		nullable: true,
	})
	updatedAt: Date | null;
}

export class PlannerSessionStatusDto {
	@ApiProperty({
		type: String,
		example: 'active',
		enum: ['active', 'expiring', 'expired', 'not_configured'],
	})
	status: PlannerSessionStatus;

	@ApiProperty({
		type: String,
		format: 'date-time',
		example: '2026-08-09T14:10:35.000Z',
		nullable: true,
	})
	tokenExp: string | null;
}
