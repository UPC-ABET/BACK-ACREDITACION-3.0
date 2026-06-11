import { ConfigService } from '@nestjs/config';

export const JWT_EXPIRES_IN_SECONDS = 60 * 60;
export const JWT_EXPIRES_IN = `${JWT_EXPIRES_IN_SECONDS}s`;
export const JWT_SECRET_MIN_LENGTH = 32;

export function getRequiredJwtSecret(configService: ConfigService): string {
	const secret = configService.get<string>('JWT_SECRET');

	if (!secret || secret.length < JWT_SECRET_MIN_LENGTH) {
		throw new Error(
			`JWT_SECRET must be configured and contain at least ${JWT_SECRET_MIN_LENGTH} characters`,
		);
	}

	return secret;
}
