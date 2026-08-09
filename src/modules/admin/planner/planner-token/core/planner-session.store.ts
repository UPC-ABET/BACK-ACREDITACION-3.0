import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PlannerTokenSession } from '../model/planner-session.types';

const DEFAULT_STORE_PATH = path.join(process.cwd(), '.scraping', 'planner_token_store.json');

/**
 * The persisted u-planner session. Separated from the token service so the service can be tested
 * without a filesystem, and so the one place that writes long-lived JWTs to disk is obvious.
 */
@Injectable()
export class PlannerSessionStore {
	constructor(private readonly config: ConfigService) {}

	read(): PlannerTokenSession | null {
		const file = this.storePath();
		if (!fs.existsSync(file)) return null;
		try {
			return JSON.parse(fs.readFileSync(file, 'utf-8')) as PlannerTokenSession;
		} catch {
			return null;
		}
	}

	save(session: PlannerTokenSession): void {
		const file = this.storePath();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		// `mode` applies only when writeFileSync creates the file, so the chmod is what protects a
		// file that already exists with looser bits.
		fs.writeFileSync(file, JSON.stringify(session, null, 2), { mode: 0o600 });
		fs.chmodSync(file, 0o600);
	}

	private storePath(): string {
		return this.config.get<string>('PLANNER_TOKEN_STORE_PATH') ?? DEFAULT_STORE_PATH;
	}
}
