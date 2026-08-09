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

	// A file that parses but is missing a load-bearing field must not reach the HTTP client, where
	// it would become `Bearer undefined` against u-planner rather than an obvious re-login.
	it('returns null for a session that parses but is incomplete', () => {
		const store = buildStore();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, '{"userId": 804988}');

		expect(store.read()).toBeNull();
	});

	// chmod is not a no-op here: writeFileSync's mode applies only when it creates the file, so an
	// existing file written under a looser umask would keep its old bits without it.
	//
	// The pre-existing file has to be the *temp* path, not the destination — save() never writes
	// into the destination, it renames over it, so seeding the destination proves nothing and the
	// assertion would hold with chmodSync deleted. A leftover `.tmp` is exactly what a crashed
	// previous save leaves behind.
	(process.platform === 'win32' ? it.skip : it)('forces 0600 on a leftover temp file', () => {
		const store = buildStore();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(`${file}.tmp`, '{}', { mode: 0o644 });
		fs.chmodSync(`${file}.tmp`, 0o644);

		store.save(SESSION);

		expect(fs.statSync(file).mode & 0o777).toBe(0o600);
	});
});
