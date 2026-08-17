import { randomUUID } from 'crypto';

/**
 * In-process registry for the survey modules' fire-and-forget background jobs
 * (PPP bulk upload, GRA/LCFC bulk send). One `Map` per instance, per process —
 * see `docs/CONTEXT.md` § Database for why that pins the service to a single
 * replica.
 *
 * Three bounds, defending against three different things and deliberately not
 * conflated:
 *
 * - `maxConcurrent` / `maxConcurrentPerOwner` cap jobs actually *running*.
 *   Finished entries linger until their TTL expires, so counting them would
 *   reject a user's 21st upload of any half-hour window with nothing running,
 *   and the fix-and-re-upload loop is the PPP feature's normal path. The
 *   per-owner bound stops one user occupying every global slot.
 * - `maxRetained` caps total entries kept, since a finished job can hold a whole
 *   annotated workbook; going over it evicts the oldest *finished* entries,
 *   never running ones.
 * - `ttlMs` drops a finished entry once nobody could reasonably still poll it.
 */
export type JobRegistryOptions = {
	ttlMs: number;
	maxConcurrent: number;
	maxConcurrentPerOwner: number;
	maxRetained: number;
};

type JobEntry<S> = {
	status: S;
	ownerId: number;
	done: boolean;
	expiry?: ReturnType<typeof setTimeout>;
};

export class JobRegistry<S extends object> {
	private readonly jobs = new Map<string, JobEntry<S>>();

	constructor(private readonly options: JobRegistryOptions) {}

	get size(): number {
		return this.jobs.size;
	}

	runningCount(ownerId?: number): number {
		let count = 0;
		for (const job of this.jobs.values()) {
			if (job.done) continue;
			if (ownerId === undefined || job.ownerId === ownerId) count++;
		}
		return count;
	}

	hasCapacity(ownerId: number): boolean {
		return (
			this.runningCount() < this.options.maxConcurrent &&
			this.runningCount(ownerId) < this.options.maxConcurrentPerOwner
		);
	}

	/**
	 * Registers a running job and returns its id. Call this before the first
	 * `await` that follows the capacity check: a check separated from
	 * registration by an await lets every request arriving inside the gap pass a
	 * bound none of them are yet counted by.
	 */
	register(ownerId: number, status: S): string {
		this.evictFinishedOverRetentionBound();
		const jobId = randomUUID();
		this.jobs.set(jobId, { status, ownerId, done: false });
		return jobId;
	}

	patch(jobId: string, patch: Partial<S>): void {
		const job = this.jobs.get(jobId);
		if (!job) return;
		job.status = { ...job.status, ...patch };
	}

	/**
	 * Marks the job finished and schedules its eviction. Idempotent, because the
	 * callers finish a job from a `.catch()` and then again from the `.finally()`
	 * that guarantees a TTL even on the paths that never reached a result.
	 */
	finish(jobId: string, status?: S): void {
		const job = this.jobs.get(jobId);
		if (!job) return;
		if (status) job.status = status;
		job.done = true;
		if (job.expiry) return;
		job.expiry = setTimeout(() => this.jobs.delete(jobId), this.options.ttlMs);
		job.expiry.unref();
	}

	/**
	 * The job's status, or `null` when it is unknown *or* belongs to someone else —
	 * one answer for both, so the 404 a caller turns this into never confirms a job
	 * id to whoever is guessing.
	 */
	get(jobId: string, ownerId: number): (S & { done: boolean }) | null {
		const job = this.jobs.get(jobId);
		if (!job || job.ownerId !== ownerId) return null;
		return { ...job.status, done: job.done };
	}

	/**
	 * Drops a job that never really started — registration succeeded and the work
	 * that follows it threw — so a rejected request does not hold a running slot
	 * until its TTL expires.
	 */
	remove(jobId: string): void {
		const job = this.jobs.get(jobId);
		if (job?.expiry) clearTimeout(job.expiry);
		this.jobs.delete(jobId);
	}

	private evictFinishedOverRetentionBound(): void {
		if (this.jobs.size < this.options.maxRetained) return;
		// Map iteration is insertion-ordered, so this drops the least recently
		// started finished jobs first.
		for (const [jobId, job] of this.jobs) {
			if (this.jobs.size < this.options.maxRetained) break;
			if (!job.done) continue;
			this.remove(jobId);
		}
	}
}
