import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { getRequiredJwtSecret } from '../jwt.config';

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), cookieExtractor]),
			ignoreExpiration: false,
			secretOrKey: getRequiredJwtSecret(configService),
		});
	}

	async validate(payload: any) {
		return {
			userId: payload.userId,
			user: payload.user,
			activeRole: payload.activeRole,
			allowedRoles: payload.allowedRoles,
			permissions: payload.permissions,
			school_id: payload.school_id,
		};
	}
}

function cookieExtractor(request: Request): string | null {
	return request?.cookies?.[ACCESS_TOKEN_COOKIE_NAME] ?? null;
}
