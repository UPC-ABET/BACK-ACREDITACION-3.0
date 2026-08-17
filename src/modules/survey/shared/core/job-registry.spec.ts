import { JobRegistry } from './job-registry';

type Status = { progressPct: number };

function buildRegistry(overrides: Partial<ConstructorParameters<typeof JobRegistry>[0]> = {}) {
	return new JobRegistry<Status>({
		ttlMs: 60_000,
		maxConcurrent: 20,
		maxConcurrentPerOwner: 3,
		maxRetained: 100,
		...overrides,
	});
}

function seed(registry: JobRegistry<Status>, ownerId: number, count: number, done: boolean) {
	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		const id = registry.register(ownerId, { progressPct: 0 });
		if (done) registry.finish(id, { progressPct: 100 });
		ids.push(id);
	}
	return ids;
}

describe('JobRegistry', () => {
	describe('capacity', () => {
		it('counts only running jobs, so finished ones never block a new one', () => {
			const registry = buildRegistry({ maxRetained: 1000 });
			seed(registry, 1, 50, true);

			expect(registry.runningCount()).toBe(0);
			expect(registry.hasCapacity(1)).toBe(true);
		});

		it('rejects an owner who already holds the per-owner bound, while others still pass', () => {
			const registry = buildRegistry({ maxConcurrentPerOwner: 3 });
			seed(registry, 1, 3, false);

			expect(registry.hasCapacity(1)).toBe(false);
			// The global bound is 20 and only 3 are running, so a second user is unaffected —
			// this is the whole point of having a per-owner bound as well as a global one.
			expect(registry.hasCapacity(2)).toBe(true);
		});

		it('rejects everyone once the global bound is reached, spread across owners', () => {
			const registry = buildRegistry({ maxConcurrent: 6, maxConcurrentPerOwner: 3 });
			seed(registry, 1, 3, false);
			seed(registry, 2, 3, false);

			expect(registry.hasCapacity(3)).toBe(false);
		});

		it('frees the slot again when a running job is removed', () => {
			const registry = buildRegistry({ maxConcurrentPerOwner: 1 });
			const [jobId] = seed(registry, 1, 1, false);

			expect(registry.hasCapacity(1)).toBe(false);
			registry.remove(jobId);
			expect(registry.hasCapacity(1)).toBe(true);
		});
	});

	describe('retention', () => {
		it('evicts the oldest finished jobs once the bound is passed, keeping running ones', () => {
			const registry = buildRegistry({ maxRetained: 10, maxConcurrentPerOwner: 100 });
			const finished = seed(registry, 1, 9, true);
			const running = seed(registry, 1, 5, false);

			expect(registry.size).toBeLessThanOrEqual(10);
			expect(registry.runningCount()).toBe(5);
			// Oldest-first: the earliest finished entries went and the most recent stayed.
			expect(registry.get(finished[0], 1)).toBeNull();
			expect(registry.get(finished[8], 1)).not.toBeNull();
			expect(registry.get(running[0], 1)).not.toBeNull();
		});

		it('never drops a running job, even when that leaves the map over its bound', () => {
			// Nothing else can be done: their callers are still polling for a result, so the
			// bound yields rather than the jobs.
			const registry = buildRegistry({ maxRetained: 3, maxConcurrentPerOwner: 100 });
			const running = seed(registry, 1, 5, false);

			expect(registry.size).toBe(5);
			running.forEach((jobId) => expect(registry.get(jobId, 1)).not.toBeNull());
		});

		it('leaves everything alone while the map is under the bound', () => {
			const registry = buildRegistry({ maxRetained: 100, maxConcurrentPerOwner: 100 });
			const finished = seed(registry, 1, 10, true);

			registry.register(1, { progressPct: 0 });

			expect(registry.get(finished[0], 1)).not.toBeNull();
		});
	});

	describe('ownership', () => {
		it('returns the status to its owner, with the done flag merged in', () => {
			const registry = buildRegistry();
			const jobId = registry.register(7, { progressPct: 40 });

			expect(registry.get(jobId, 7)).toEqual({ progressPct: 40, done: false });
			registry.finish(jobId, { progressPct: 100 });
			expect(registry.get(jobId, 7)).toEqual({ progressPct: 100, done: true });
		});

		it('answers null for another user exactly as it does for an unknown id', () => {
			const registry = buildRegistry();
			const jobId = registry.register(7, { progressPct: 40 });

			expect(registry.get(jobId, 8)).toBeNull();
			expect(registry.get('never-existed', 8)).toBeNull();
		});

		it('hands back a copy, so a caller cannot mutate the stored status', () => {
			const registry = buildRegistry();
			const jobId = registry.register(1, { progressPct: 10 });

			const status = registry.get(jobId, 1);
			status!.progressPct = 99;

			expect(registry.get(jobId, 1)!.progressPct).toBe(10);
		});
	});

	describe('lifecycle', () => {
		it('patches only the given fields', () => {
			const registry = new JobRegistry<{ progressPct: number; rows: number }>({
				ttlMs: 60_000,
				maxConcurrent: 5,
				maxConcurrentPerOwner: 5,
				maxRetained: 50,
			});
			const jobId = registry.register(1, { progressPct: 0, rows: 12 });

			registry.patch(jobId, { progressPct: 50 });

			expect(registry.get(jobId, 1)).toEqual({ progressPct: 50, rows: 12, done: false });
		});

		it('evicts a finished job once its TTL elapses', () => {
			jest.useFakeTimers();
			try {
				const registry = buildRegistry({ ttlMs: 1_000 });
				const jobId = registry.register(1, { progressPct: 0 });

				registry.finish(jobId, { progressPct: 100 });
				expect(registry.get(jobId, 1)).not.toBeNull();

				jest.advanceTimersByTime(1_000);
				expect(registry.get(jobId, 1)).toBeNull();
			} finally {
				jest.useRealTimers();
			}
		});

		it('does not stack a second timer when finish is called twice', () => {
			jest.useFakeTimers();
			try {
				const registry = buildRegistry({ ttlMs: 1_000 });
				const jobId = registry.register(1, { progressPct: 0 });

				registry.finish(jobId, { progressPct: 100 });
				jest.advanceTimersByTime(600);
				// A second finish (the `.finally()` after a `.catch()` that already finished the
				// job) must not push the eviction out by another full TTL.
				registry.finish(jobId);
				jest.advanceTimersByTime(400);

				expect(registry.get(jobId, 1)).toBeNull();
				expect(jest.getTimerCount()).toBe(0);
			} finally {
				jest.useRealTimers();
			}
		});

		it('ignores patch and finish for an id that is already gone', () => {
			const registry = buildRegistry();

			expect(() => registry.patch('gone', { progressPct: 1 })).not.toThrow();
			expect(() => registry.finish('gone')).not.toThrow();
		});
	});
});
