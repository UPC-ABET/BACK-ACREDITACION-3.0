import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
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
			this.logger.warn(`Planner session store at ${file} is unreadable: ${describe(error)}`);
			return null;
		}

		if (!isUsableSession(parsed)) {
			this.logger.warn(`Planner session store at ${file} is missing required fields`);
			return null;
		}
		return parsed;
	}

	// Written to a sibling then renamed: `writeFileSync` truncates in place, so a concurrent read
	// during the write can observe a half-file. Rename is atomic within a filesystem.
	save(session: PlannerTokenSession): void {
		const file = this.storePath();
		const temp = `${file}.tmp`;

		fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
		fs.writeFileSync(temp, JSON.stringify(session, null, 2), { mode: 0o600 });
		fs.chmodSync(temp, 0o600);
		fs.renameSync(temp, file);
	}

	private storePath(): string {
		return this.config.get<string>('PLANNER_TOKEN_STORE_PATH') ?? DEFAULT_STORE_PATH;
	}
}

const describe = (error: unknown): string => (error instanceof Error ? error.message : 'unknown');
