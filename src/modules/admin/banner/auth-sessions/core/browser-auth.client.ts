import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ControllerStatus = 'active' | 'completed' | 'failed' | 'expired';

// Stable UPC host — env-overridable but defaulted so it isn't required config.
const DEFAULT_BANNER_INTRANET_URL = 'https://intranetdocente-administrativo.upc.edu.pe';

export interface BrowserAuthCredentials {
	username: string;
	password: string;
}

@Injectable()
export class BrowserAuthClient {
	constructor(private readonly config: ConfigService) {}

	/**
	 * `credentials` are forwarded once, in this single request body, to the browser-auth
	 * controller — never logged here, never persisted anywhere in this NestJS process.
	 */
	async start(sessionId: string, credentials?: BrowserAuthCredentials): Promise<void> {
		const res = await fetch(`${this.base()}/sessions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				sessionId,
				intranetUrl: this.config.get<string>('BANNER_INTRANET_URL') ?? DEFAULT_BANNER_INTRANET_URL,
				authStatePath: this.config.getOrThrow<string>('BANNER_AUTH_STATE_PATH'),
				...(credentials ? { credentials } : {}),
			}),
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(`browser-auth start failed: HTTP ${res.status} ${body}`.trim());
		}
	}

	async status(sessionId: string): Promise<ControllerStatus> {
		const res = await fetch(`${this.base()}/sessions/${encodeURIComponent(sessionId)}`);
		if (!res.ok) throw new Error(`browser-auth status failed: HTTP ${res.status}`);
		const body = (await res.json()) as { status: ControllerStatus };
		return body.status;
	}

	async stop(sessionId: string): Promise<void> {
		await fetch(`${this.base()}/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
	}

	private base(): string {
		return this.config.getOrThrow<string>('BROWSER_AUTH_INTERNAL_URL').replace(/\/$/, '');
	}
}
