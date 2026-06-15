import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage, Server } from 'http';
import { Duplex } from 'stream';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { API_GLOBAL_PREFIX } from 'src/shared/constants/app.constants';
import { AuthSessionService } from '../api/auth-sessions.service';

// Nginx forwards the full path (incl. the global prefix) to the backend, and the
// raw upgrade handler bypasses Nest's prefix stripping — so match the prefixed path.
const STREAM_PATH = `/${API_GLOBAL_PREFIX}/banner/auth/stream`;

interface PendingFrame {
	data: RawData;
	binary: boolean;
}

// Authenticated wss -> private noVNC proxy. The browser/noVNC is never public;
// the only way in is this proxy, which validates the one-time session token on
// the upgrade handshake before piping frames to the browser-auth container.
@Injectable()
export class BannerAuthStreamGateway implements OnApplicationBootstrap {
	private readonly logger = new Logger(BannerAuthStreamGateway.name);
	private wss: WebSocketServer | null = null;

	constructor(
		private readonly adapterHost: HttpAdapterHost,
		private readonly config: ConfigService,
		private readonly sessionService: AuthSessionService,
	) {}

	onApplicationBootstrap(): void {
		const server: Server | undefined = this.adapterHost.httpAdapter?.getHttpServer();
		if (!server) {
			this.logger.warn('No HTTP server available; Banner auth stream proxy disabled');
			return;
		}
		this.wss = new WebSocketServer({
			noServer: true,
			handleProtocols: (protocols) => protocols.values().next().value ?? false,
		});
		server.on('upgrade', (req, socket, head) => this.onUpgrade(req, socket as Duplex, head));
	}

	private onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
		let url: URL;
		try {
			url = new URL(req.url ?? '', 'http://localhost');
		} catch {
			return;
		}
		if (url.pathname !== STREAM_PATH) return; // not our endpoint; leave it alone

		let sessionId: string;
		try {
			sessionId = this.sessionService.consumeStreamToken(url.searchParams.get('token'));
		} catch {
			socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
			socket.destroy();
			return;
		}

		this.wss?.handleUpgrade(req, socket, head, (client) => this.proxy(client, req, sessionId));
	}

	private proxy(client: WebSocket, req: IncomingMessage, sessionId: string): void {
		const upstreamUrl = this.config.getOrThrow<string>('BROWSER_AUTH_VNC_WS_URL');
		const protocols = (req.headers['sec-websocket-protocol'] ?? '')
			.split(',')
			.map((p) => p.trim())
			.filter(Boolean);
		const upstream = new WebSocket(upstreamUrl, protocols.length ? protocols : undefined);

		const pending: PendingFrame[] = [];

		const closeBoth = () => {
			try {
				client.close();
			} catch {
				/* noop */
			}
			try {
				upstream.close();
			} catch {
				/* noop */
			}
		};

		upstream.on('open', () => {
			for (const frame of pending) upstream.send(frame.data, { binary: frame.binary });
			pending.length = 0;
		});
		upstream.on('message', (data, isBinary) => {
			if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
		});
		client.on('message', (data, isBinary) => {
			if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
			else pending.push({ data, binary: isBinary });
		});

		upstream.on('close', closeBoth);
		client.on('close', closeBoth);
		upstream.on('error', (err) => {
			this.logger.warn(`upstream ws ${sessionId}: ${err.message}`);
			closeBoth();
		});
		client.on('error', () => closeBoth());
	}
}
