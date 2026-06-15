'use strict';

// Browser-auth controller: the backend-owned Playwright controller that runs
// INSIDE the browser-auth container (headful Chromium on the Xvfb display so the
// session is streamable over noVNC). NestJS drives its lifecycle over the private
// control API. Mirrors the prototype main.ts login: navigate to the intranet,
// wait for localStorage.token, then save the Playwright storage state to the
// shared volume. Single session at a time (matches the API's single-flight).

const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = Number(process.env.CONTROL_PORT) || 7000;

// Only allow top-level navigation to UPC / Microsoft login domains, so the
// streamed browser can't be abused as an open proxy. Subresources are allowed.
const ALLOWED_HOST =
	/(^|\.)(upc\.edu\.pe|microsoftonline\.com|microsoft\.com|live\.com|msauth\.net|msftauth\.net|office\.com|office365\.com|windows\.net)$/i;

/** @type {{ id: string, status: string, browser: import('playwright').Browser | null } | null} */
let session = null;

async function teardownBrowser() {
	if (session && session.browser) {
		await session.browser.close().catch(() => {});
		session.browser = null;
	}
}

async function startSession({ sessionId, intranetUrl, authStatePath }) {
	if (session && session.status === 'active') {
		throw new Error('a login session is already in progress');
	}
	session = { id: sessionId, status: 'active', browser: null };

	const browser = await chromium.launch({
		headless: false,
		args: ['--no-sandbox', '--disable-dev-shm-usage', '--start-maximized'],
	});
	session.browser = browser;

	const context = await browser.newContext({ viewport: null });
	const page = await context.newPage();

	await context.route('**/*', (route) => {
		const request = route.request();
		const isTopNav =
			request.resourceType() === 'document' &&
			request.isNavigationRequest() &&
			request.frame() === page.mainFrame();
		if (isTopNav && !ALLOWED_HOST.test(new URL(request.url()).hostname)) {
			return route.abort();
		}
		return route.continue();
	});

	await page.goto(intranetUrl, { waitUntil: 'domcontentloaded' });

	// Detached watcher: survives the whole SSO redirect chain. On success, persist
	// cookies + localStorage to the shared volume at 0600, then tear down.
	page
		.waitForFunction(() => !!window.localStorage.getItem('token'), null, {
			timeout: 0,
			polling: 1000,
		})
		.then(async () => {
			await context.storageState({ path: authStatePath });
			fs.chmodSync(authStatePath, 0o600);
			if (session) session.status = 'completed';
			await teardownBrowser();
		})
		.catch(async () => {
			if (session) session.status = 'failed';
			await teardownBrowser();
		});
}

function send(res, code, body) {
	res.writeHead(code, { 'content-type': 'application/json' });
	res.end(body ? JSON.stringify(body) : undefined);
}

const server = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://localhost');
	const sessionsMatch = url.pathname.match(/^\/sessions\/?([^/]*)$/);
	if (!sessionsMatch) return send(res, 404, { error: 'not found' });
	const id = decodeURIComponent(sessionsMatch[1] || '');

	if (req.method === 'POST' && !id) {
		let raw = '';
		req.on('data', (chunk) => (raw += chunk));
		req.on('end', () => {
			let body;
			try {
				body = JSON.parse(raw || '{}');
			} catch {
				return send(res, 400, { error: 'invalid json' });
			}
			startSession(body)
				.then(() => send(res, 200, { sessionId: body.sessionId, status: 'active' }))
				.catch((err) => send(res, 409, { error: err.message }));
		});
		return;
	}

	if (req.method === 'GET' && id) {
		if (!session || session.id !== id) return send(res, 404, { error: 'not found' });
		return send(res, 200, { status: session.status });
	}

	if (req.method === 'DELETE' && id) {
		if (session && session.id === id) {
			teardownBrowser().finally(() => {
				session = null;
				send(res, 204);
			});
			return;
		}
		return send(res, 404, { error: 'not found' });
	}

	return send(res, 405, { error: 'method not allowed' });
});

server.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`browser-auth controller listening on ${PORT}`);
});
