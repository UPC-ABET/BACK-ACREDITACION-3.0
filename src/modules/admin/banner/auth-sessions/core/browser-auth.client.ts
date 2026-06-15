import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ControllerStatus = 'active' | 'completed' | 'failed' | 'expired';

// HTTP client for the browser-auth container's private control API. The
// container owns the Playwright controller that launches a headful browser on
// xvfb, navigates to the intranet, watches for localStorage.token, and writes
// auth_state.json to the shared volume. This client only drives that lifecycle.
@Injectable()
export class BrowserAuthClient {
	constructor(private readonly config: ConfigService) {}

	async start(sessionId: string): Promise<void> {
		const res = await fetch(`${this.base()}/sessions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				sessionId,
				intranetUrl: this.config.getOrThrow<string>('BANNER_INTRANET_URL'),
				authStatePath: this.config.getOrThrow<string>('BANNER_AUTH_STATE_PATH'),
			}),
		});
		if (!res.ok) {
			throw new Error(`browser-auth start failed: HTTP ${res.status}`);
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
