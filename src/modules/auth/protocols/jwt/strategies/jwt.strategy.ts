import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { getRequiredJwtSecret } from '../jwt.config';
import { UserAuthorizationService } from 'src/modules/organization/users/api/user-authorization.service';
import { usersValidationStrings } from 'src/modules/organization/users/config/strings/users.validation';

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		configService: ConfigService,
		private readonly userAuthorizationService: UserAuthorizationService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				ExtractJwt.fromAuthHeaderAsBearerToken(),
				cookieExtractor,
			]),
			ignoreExpiration: false,
			secretOrKey: getRequiredJwtSecret(configService),
		});
	}

	async validate(payload: { userId: number; activeRoleId?: number; schoolId: number }) {
		try {
			const profile = await this.userAuthorizationService.buildAuthorizationProfile(
				Number(payload.userId),
				payload.activeRoleId,
			);

			return {
				userId: payload.userId,
				activeRole: profile.activeRole,
				allowedRoles: profile.allowedRoles,
				permissions: profile.permissions,
				schoolId: payload.schoolId,
			};
		} catch {
			throw new UnauthorizedException(usersValidationStrings.error.invalidCredentials);
		}
	}
}

function cookieExtractor(request: Request): string | null {
	return request?.cookies?.[ACCESS_TOKEN_COOKIE_NAME] ?? null;
}
