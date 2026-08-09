import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PlannerTokenSession } from '../model/planner-session.types';
import { PlannerSessionStore } from './planner-session.store';

const SESSION: PlannerTokenSession = {
	userId: 804988,
	accessToken: 'example-access-token',
	accessTokenExpiresAt: '2026-08-09T14:10:35.000Z',
	refreshToken: 'example-refresh-token',
	refreshTokenExpiresAt: '2026-08-09T16:34:35.000Z',
};

let dir: string;
let file: string;

// Answers only for the key the store is supposed to ask for. A stub that returns the path for
// every key cannot tell whether the store reads the right one — and when it does not, the spec
// silently writes into the repository working tree instead of the temp dir.
const buildStore = () =>
	new PlannerSessionStore({
		get: (key: string) => (key === 'PLANNER_TOKEN_STORE_PATH' ? file : undefined),
	} as unknown as ConfigService);

describe('PlannerSessionStore', () => {
	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-store-'));
		file = path.join(dir, 'nested', 'planner_token_store.json');
	});

	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	it('returns null when no session has been stored', () => {
		expect(buildStore().read()).toBeNull();
	});

	it('round-trips a session, creating the directory', () => {
		const store = buildStore();
		store.save(SESSION);

		expect(store.read()).toEqual(SESSION);
	});

	// JSON.stringify drops undefined keys, so an absent refresh token must survive the round trip
	// as absent rather than reappearing as something a consumer could misread.
	it('round-trips a session that carries no refresh token', () => {
		const store = buildStore();
		store.save({ ...SESSION, refreshToken: undefined, refreshTokenExpiresAt: null });

		const read = store.read();
		expect(read?.accessToken).toBe('example-access-token');
		expect(read?.refreshToken).toBeUndefined();
	});

	// The fail-safe against a wedged session: a half-written or hand-edited file must degrade to
	// "log in again", never throw into the caller.
	it('returns null rather than throwing when the file is corrupt', () => {
		const store = buildStore();
		store.save(SESSION);
		fs.writeFileSync(file, '{"userId": 804988, "accessTo');

		expect(() => store.read()).not.toThrow();
		expect(store.read()).toBeNull();
	});

	// One case per field: a fixture missing everything cannot tell which guard is doing the work, so
	// any single guard could be deleted without a test noticing.
	it.each([
		['userId', { accessToken: 'a', accessTokenExpiresAt: '2026-08-09T14:10:35.000Z' }],
		['accessToken', { userId: 804988, accessTokenExpiresAt: '2026-08-09T14:10:35.000Z' }],
		['accessTokenExpiresAt', { userId: 804988, accessToken: 'a' }],
	])('returns null for a session with no %s', (_label, partial) => {
		const store = buildStore();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(partial));

		expect(store.read()).toBeNull();
	});

	// The file holds a long-lived institutional JWT, so the mode is not incidental. `writeFileSync`'s
	// mode applies only when it creates the file, hence the explicit fchmod on the descriptor.
	const onPosix = process.platform === 'win32' ? it.skip : it;

	onPosix('writes the session 0600', () => {
		buildStore().save(SESSION);

		expect(fs.statSync(file).mode & 0o777).toBe(0o600);
	});

	onPosix('creates the directory 0700', () => {
		buildStore().save(SESSION);

		expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700);
	});

	// The temp name is randomised and opened `wx`, so a planted symlink cannot be written through
	// and a leftover temp file cannot be reused. Nothing may be left behind either.
	it('leaves no temp file behind and does not reuse a predictable name', () => {
		const store = buildStore();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(`${file}.tmp`, 'planted', { mode: 0o644 });

		store.save(SESSION);

		expect(store.read()).toEqual(SESSION);
		expect(fs.readFileSync(`${file}.tmp`, 'utf-8')).toBe('planted');
		expect(fs.readdirSync(path.dirname(file)).filter((n) => n.endsWith('.tmp'))).toEqual([
			'planner_token_store.json.tmp',
		]);
	});
});
