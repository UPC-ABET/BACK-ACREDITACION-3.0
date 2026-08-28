'use strict';

// Control API (driven by NestJS) that runs headful Chromium on the Xvfb display
// so the login is streamable over noVNC, then saves the storage state on success.

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

/**
 * Fills in Microsoft/Outlook's SSO email + password steps automatically instead of leaving
 * every field to be typed by hand on the streamed VNC view. Best-effort by design: every step
 * has its own short timeout and any failure is swallowed, because the live VNC session is still
 * running in parallel and lets the person watching finish by hand — whether that's a selector
 * mismatch or MFA/"stay signed in" needing a real human. `credentials` only ever lives in this
 * function's local scope, is never logged, never written to disk.
 *
 * Ported from PORTFOLIO-AUDIT's `attemptAutoFillCredentials` (same selectors, same
 * pressSequentially-over-fill reasoning: Microsoft's own JS validator doesn't reliably pick up
 * a directly-set DOM value, only real per-character keyboard events).
 */
async function attemptAutoFillCredentials(page, credentials) {
	const shortWait = { timeout: 12000 };
	try {
		const emailInput = page.locator('input[type="email"], input[name="loginfmt"]').first();
		await emailInput.waitFor(shortWait);
		await emailInput.click();
		await emailInput.pressSequentially(credentials.username, { delay: 20 });
		await clickSubmit(page);

		const passwordInput = page.locator('input[type="password"], input[name="passwd"]').first();
		await passwordInput.waitFor(shortWait);
		await passwordInput.click();
		await passwordInput.pressSequentially(credentials.password, { delay: 20 });
		await clickSubmit(page);

		// "¿Mantener la sesión iniciada?" — short timeout: this prompt may not appear at all.
		await clickSubmit(page, { timeout: 5000 });
	} catch (err) {
		console.warn(
			'autofill did not complete every step (continuing manually via VNC):',
			err.message,
		);
	}
}

/** Microsoft's login pages reuse the same submit control (id="idSIButton9") for "Next", "Sign in", and "Yes" on the "stay signed in" prompt. */
async function clickSubmit(page, options) {
	const button = page.locator('#idSIButton9, input[type="submit"], button[type="submit"]').first();
	await button.waitFor(options || { timeout: 8000 });
	await button.click();
}

async function startSession({ sessionId, intranetUrl, authStatePath, credentials }) {
	if (session && session.status === 'active') {
		const err = new Error('a login session is already in progress');
		err.code = 'IN_PROGRESS';
		throw err;
	}
	session = { id: sessionId, status: 'active', browser: null };

	let context;
	try {
		const browser = await chromium.launch({
			headless: false,
			executablePath: process.env.CHROMIUM_PATH || undefined,
			// Keep this minimal: it's an interactive, headful login browser used
			// rarely and one-at-a-time, so correctness beats shaving memory.
			// --disable-gpu is safe in a headless-host container; nothing else added.
			args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--start-maximized'],
		});
		session.browser = browser;

		context = await browser.newContext({ viewport: null });
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
		if (credentials && credentials.username && credentials.password) {
			await attemptAutoFillCredentials(page, credentials);
		}
		registerTokenWatcher(page, context, authStatePath);
	} catch (err) {
		// Make the real cause observable, and clear the slot so it never sticks.
		console.error('startSession failed:', err);
		await teardownBrowser();
		session = null;
		throw err;
	}
}

function registerTokenWatcher(page, context, authStatePath) {
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
				.catch((err) =>
					err && err.code === 'IN_PROGRESS'
						? send(res, 409, { error: err.message })
						: send(res, 500, { error: err.message }),
				);
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
	console.log(`browser-auth controller listening on ${PORT}`);
});
