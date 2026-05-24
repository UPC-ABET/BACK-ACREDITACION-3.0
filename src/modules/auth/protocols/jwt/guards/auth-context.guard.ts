import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UserAuthorizationService } from 'src/modules/organization/users/api/user-authorization.service';
import { AuthContext } from 'src/modules/auth/model/authorization.types';

type AuthRequest = Request & { auth?: AuthContext; user?: any };

@Injectable()
export class AuthContextGuard implements CanActivate {
	constructor(
		private readonly jwtService: JwtService,
		private readonly userAuthorizationService: UserAuthorizationService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest<AuthRequest>();
		const token = this.extractToken(req);

		if (!token) {
			throw new UnauthorizedException('Token requerido');
		}

		let payload: any;
		try {
			payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
		} catch {
			throw new UnauthorizedException('Token invalido o expirado');
		}

		if (!payload?.userId) {
			throw new UnauthorizedException('Claims insuficientes en token');
		}

		const activeRoleIdFromToken = Number(payload.activeRole?.id ?? payload.activeRoleId);
		const authProfile = await this.userAuthorizationService.buildAuthorizationProfile(
			Number(payload.userId),
			Number.isFinite(activeRoleIdFromToken) ? activeRoleIdFromToken : undefined,
		);

		req.auth = {
			userId: Number(payload.userId),
			activeRole: authProfile.activeRole,
			allowedRoles: authProfile.allowedRoles,
			permissions: authProfile.permissions,
			tokenPayload: payload,
		};
		req.user = payload.user ?? { id: req.auth.userId };

		return true;
	}

	private extractToken(req: Request): string | null {
		const authHeader = req.headers?.authorization;
		if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
			return authHeader.slice(7).trim();
		}

		const cookieToken = (req as any).cookies?.access_token;
		if (typeof cookieToken === 'string') {
			return cookieToken;
		}

		const cookieHeader = req.headers?.cookie;
		if (typeof cookieHeader === 'string') {
			const token = cookieHeader
				.split(';')
				.map((part) => part.trim())
				.find((part) => part.startsWith('access_token='))
				?.slice('access_token='.length);

			if (token) {
				return decodeURIComponent(token);
			}
		}

		return null;
	}
}
