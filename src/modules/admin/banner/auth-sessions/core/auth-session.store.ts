import { Injectable } from '@nestjs/common';

export type AuthSessionStatus = 'active' | 'completed' | 'failed' | 'expired';

export interface AuthSession {
	id: string;
	status: AuthSessionStatus;
	createdAt: Date;
	expiresAt: Date;
	tokenUsed: boolean;
	startedBy: string | null;
	watcher?: ReturnType<typeof setInterval>;
}

// Single-flight, in-memory session holder: at most one Banner login session
// exists at a time (per the spec's single concurrent session requirement).
@Injectable()
export class AuthSessionStore {
	private current: AuthSession | null = null;

	hasActive(): boolean {
		return this.current?.status === 'active';
	}

	getById(id: string): AuthSession | null {
		return this.current && this.current.id === id ? this.current : null;
	}

	create(session: AuthSession): void {
		this.current = session;
	}

	update(id: string, patch: Partial<AuthSession>): void {
		if (this.current && this.current.id === id) {
			this.current = { ...this.current, ...patch };
		}
	}
}
