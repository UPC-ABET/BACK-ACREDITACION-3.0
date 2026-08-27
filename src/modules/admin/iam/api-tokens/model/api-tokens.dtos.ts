import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsDateString,
	IsIn,
	IsOptional,
	IsString,
	Length,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

export class ApiTokenScopeDto {
	@IsIn(Object.values(PERMISSION_MODULES))
	@ApiProperty({ example: PERMISSION_MODULES.ACADEMIC, enum: PERMISSION_MODULES })
	module: string;

	@IsIn(Object.values(PERMISSION_ACTIONS))
	@ApiProperty({ example: PERMISSION_ACTIONS.GET, enum: PERMISSION_ACTIONS })
	action: string;
}

export class CreateApiTokenDto {
	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'Integration X', required: true })
	name: string;

	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => ApiTokenScopeDto)
	@ApiProperty({ type: [ApiTokenScopeDto], required: true })
	scopes: ApiTokenScopeDto[];

	@IsOptional()
	@IsDateString()
	@ApiProperty({ example: '2027-01-01T00:00:00.000Z', required: false })
	expiresAt?: string;
}

// No `scopes`/`isActive` here — scope change is revoke-and-reissue, not an edit (D-decision in
// design.md); `forbidNonWhitelisted: true` (global) already 400s a body carrying either key.
export class UpdateApiTokenDto {
	@IsOptional()
	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'Integration X', required: false })
	name?: string;

	@IsOptional()
	@IsDateString()
	@ApiProperty({ example: '2027-01-01T00:00:00.000Z', required: false, nullable: true })
	expiresAt?: string | null;
}

export class FilterApiTokenDto {
	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Integration X', required: false })
	name?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

/** The only response shape carrying the plaintext `apiKey` — issuance only, exactly once (AC-6). */
export class IssuedApiTokenDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiProperty()
	keyId: string;

	@ApiProperty({ type: [ApiTokenScopeDto] })
	scopes: ApiTokenScopeDto[];

	@ApiProperty({ required: false, nullable: true })
	expiresAt: Date | null;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty({ description: 'Plaintext secret material, returned exactly once.' })
	apiKey: string;
}
