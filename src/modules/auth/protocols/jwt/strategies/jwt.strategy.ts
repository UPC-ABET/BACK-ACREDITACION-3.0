import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor() {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(request) => {
					if (request?.cookies?.access_token) {
						return request.cookies.access_token;
					}
					return null;
				},
				ExtractJwt.fromAuthHeaderAsBearerToken(),
			]),
			ignoreExpiration: false,
			secretOrKey: process.env.JWT_SECRET,
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
