import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getRequiredJwtSecret } from '../jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
