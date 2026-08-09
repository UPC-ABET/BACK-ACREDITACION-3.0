import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { describeError } from 'src/libs/error.functions';
import { PlannerTokenSession } from '../model/planner-session.types';

const DEFAULT_STORE_PATH = path.join(process.cwd(), '.scraping', 'planner_token_store.json');

const isUsableSession = (value: unknown): value is PlannerTokenSession => {
	if (typeof value !== 'object' || value === null) return false;
	const session = value as Partial<PlannerTokenSession>;
	return (
		typeof session.userId === 'number' &&
		typeof session.accessToken === 'string' &&
		typeof session.accessTokenExpiresAt === 'string'
	);
};

/**
 * The persisted u-planner session. Separated from the token service so the service can be tested
 * without a filesystem, and so the one place that writes long-lived JWTs to disk is obvious.
 */
@Injectable()
export class PlannerSessionStore {
	private readonly logger = new Logger(PlannerSessionStore.name);

	constructor(private readonly config: ConfigService) {}

	/**
	 * Anything unreadable degrades to `null`, which every caller already treats as "log in again".
	 * The shape is checked rather than asserted: a truncated file that still parses would otherwise
	 * reach the HTTP client as `Bearer undefined`.
	 */
	read(): PlannerTokenSession | null {
		const file = this.storePath();
		if (!fs.existsSync(file)) return null;

		let parsed: unknown;
		try {
			parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
		} catch (error) {
			this.logger.warn(`Planner session store at ${file} is unreadable: ${describeError(error)}`);
			return null;
		}

		if (!isUsableSession(parsed)) {
			this.logger.warn(`Planner session store at ${file} is missing required fields`);
			return null;
		}
		return parsed;
	}

	/**
	 * Written to a sibling then renamed: `writeFileSync` truncates in place, so a concurrent read
	 * during the write can observe a half-file. Rename is atomic within a filesystem.
	 *
	 * The sibling is opened `wx` with a random suffix, and the mode is applied to the descriptor
	 * rather than the path. The default `w` flag follows a symlink, so a predictable temp name in a
	 * directory someone else can write to lets them have this process write long-lived u-planner
	 * JWTs through the link — and a path-based `chmod` would then re-permission their target rather
	 * than our file. `wx` fails outright if the name already exists, symlink included.
	 */
	save(session: PlannerTokenSession): void {
		const file = this.storePath();
		const temp = `${file}.${randomBytes(6).toString('hex')}.tmp`;

		fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });

		const handle = fs.openSync(temp, 'wx', 0o600);
		try {
			fs.writeFileSync(handle, JSON.stringify(session, null, 2));
			fs.fchmodSync(handle, 0o600);
		} finally {
			fs.closeSync(handle);
		}

		try {
			fs.renameSync(temp, file);
		} catch (error) {
			fs.rmSync(temp, { force: true });
			throw error;
		}
	}

	private storePath(): string {
		return this.config.get<string>('PLANNER_TOKEN_STORE_PATH') ?? DEFAULT_STORE_PATH;
	}
}
