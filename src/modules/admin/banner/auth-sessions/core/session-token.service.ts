import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

const TOKEN_PURPOSE = 'banner-auth-stream';
const DEFAULT_TTL_SECONDS = 300;

interface StreamTokenPayload {
	sid: string;
	purpose: string;
}

// Mints/verifies the one-time, short-TTL JWT that authorizes a single noVNC
// websocket connection. Uses a dedicated secret (AUTH_SESSION_TOKEN_SECRET),
// separate from the app's JWT_SECRET.
@Injectable()
export class SessionTokenService {
	constructor(
		private readonly jwt: JwtService,
		private readonly config: ConfigService,
	) {}

	mint(sessionId: string): { token: string; expiresAt: Date } {
		const ttl = this.ttlSeconds();
		const token = this.jwt.sign(
			{ sid: sessionId, purpose: TOKEN_PURPOSE },
			{ secret: this.secret(), expiresIn: ttl },
		);
		return { token, expiresAt: new Date(Date.now() + ttl * 1000) };
	}

	verify(token: string): string {
		let payload: StreamTokenPayload;
		try {
			payload = this.jwt.verify<StreamTokenPayload>(token, { secret: this.secret() });
		} catch {
			throw new UnauthorizedException();
		}
		if (payload.purpose !== TOKEN_PURPOSE || !payload.sid) {
			throw new UnauthorizedException();
		}
		return payload.sid;
	}

	private secret(): string {
		return this.config.getOrThrow<string>('AUTH_SESSION_TOKEN_SECRET');
	}

	private ttlSeconds(): number {
		return Number(this.config.get<string>('AUTH_SESSION_TTL_SECONDS')) || DEFAULT_TTL_SECONDS;
	}
}
