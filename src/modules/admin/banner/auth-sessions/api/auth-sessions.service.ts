import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthSessionStatus, AuthSessionStore } from '../core/auth-session.store';
import { SessionTokenService } from '../core/session-token.service';
import { BrowserAuthClient } from '../core/browser-auth.client';
import { authSessionsValidationStrings } from '../config/strings/auth-sessions.validation';

const WATCH_INTERVAL_MS = 2_000;
const SESSION_TIMEOUT_MS = 10 * 60_000;

export interface StartSessionResult {
	sessionId: string;
	wsUrl: string;
	sessionToken: string;
	expiresAt: string;
}

@Injectable()
export class AuthSessionService {
	private readonly logger = new Logger(AuthSessionService.name);

	constructor(
		private readonly store: AuthSessionStore,
		private readonly tokenService: SessionTokenService,
		private readonly browserAuth: BrowserAuthClient,
	) {}

	async start(startedBy: string | null): Promise<StartSessionResult> {
		if (this.store.hasActive()) {
			throw new HttpException(
				authSessionsValidationStrings.error.sessionInProgress,
				HttpStatus.CONFLICT,
			);
		}

		const sessionId = randomUUID();
		try {
			await this.browserAuth.start(sessionId);
		} catch (error) {
			this.logger.error(`browser-auth unavailable: ${(error as Error).message}`);
			throw new HttpException(
				authSessionsValidationStrings.error.browserAuthUnavailable,
				HttpStatus.BAD_GATEWAY,
			);
		}

		const { token, expiresAt } = this.tokenService.mint(sessionId);
		this.store.create({
			id: sessionId,
			status: 'active',
			createdAt: new Date(),
			expiresAt,
			tokenUsed: false,
			startedBy,
		});
		this.audit('start', sessionId, startedBy);
		this.beginWatch(sessionId);

		return {
			sessionId,
			wsUrl: `/banner/auth/stream?token=${token}`,
			sessionToken: token,
			expiresAt: expiresAt.toISOString(),
		};
	}

	getStatus(id: string): { status: AuthSessionStatus } {
		const session = this.store.getById(id);
		if (!session) {
			throw new HttpException(authSessionsValidationStrings.error.notFound, HttpStatus.NOT_FOUND);
		}
		return { status: session.status };
	}

	async teardown(id: string): Promise<{ status: AuthSessionStatus }> {
		const session = this.store.getById(id);
		if (!session) {
			throw new HttpException(authSessionsValidationStrings.error.notFound, HttpStatus.NOT_FOUND);
		}
		await this.finish(id, 'failed');
		return { status: 'failed' };
	}

	// Called by the ws proxy gateway: validate + single-use consume of the token.
	consumeStreamToken(token: string | null): string {
		if (!token) throw new HttpException('unauthorized', HttpStatus.UNAUTHORIZED);
		const sessionId = this.tokenService.verify(token);
		const session = this.store.getById(sessionId);
		if (!session || session.status !== 'active' || session.tokenUsed) {
			throw new HttpException('unauthorized', HttpStatus.UNAUTHORIZED);
		}
		this.store.update(sessionId, { tokenUsed: true });
		return sessionId;
	}

	private beginWatch(sessionId: string): void {
		const deadline = Date.now() + SESSION_TIMEOUT_MS;
		const watcher = setInterval(() => {
			void this.poll(sessionId, deadline);
		}, WATCH_INTERVAL_MS);
		this.store.update(sessionId, { watcher });
	}

	private async poll(sessionId: string, deadline: number): Promise<void> {
		const session = this.store.getById(sessionId);
		if (!session || session.status !== 'active') return;
		if (Date.now() > deadline) {
			await this.finish(sessionId, 'expired');
			return;
		}
		try {
			const status = await this.browserAuth.status(sessionId);
			if (status === 'completed' || status === 'failed' || status === 'expired') {
				await this.finish(sessionId, status);
			}
		} catch (error) {
			// Transient control-API hiccup: keep polling until the deadline.
			this.logger.warn(`watch ${sessionId}: ${(error as Error).message}`);
		}
	}

	private async finish(sessionId: string, status: AuthSessionStatus): Promise<void> {
		const session = this.store.getById(sessionId);
		if (!session) return;
		if (session.watcher) clearInterval(session.watcher);
		this.store.update(sessionId, { status, watcher: undefined });
		await this.browserAuth.stop(sessionId).catch(() => undefined);
		this.audit('finish', sessionId, session.startedBy, status);
	}

	private audit(
		action: string,
		sessionId: string,
		startedBy: string | null,
		result?: string,
	): void {
		this.logger.log(
			`AUDIT banner-auth ${action} session=${sessionId} by=${startedBy ?? 'unknown'}${
				result ? ` result=${result}` : ''
			}`,
		);
	}
}
