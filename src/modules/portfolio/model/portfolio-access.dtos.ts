import { IsArray, IsBoolean, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPortfolioAccessDto {
	@ApiProperty({ description: 'Grants access to the entire portfolio namespace', example: false })
	@IsBoolean()
	fullAccess: boolean;

	@ApiProperty({
		description: 'Relative S3 prefixes the user can access (ignored when fullAccess is true)',
		example: ['EPE/IS/', 'Pregrado/CC/2024/'],
		type: [String],
	})
	@IsArray()
	@IsString({ each: true })
	allowedPrefixes: string[];
}

export type PortfolioUserAccess = {
	userId: number;
	fullName: string;
	email: string;
	fullAccess: boolean;
	allowedPrefixes: string[];
};
