/**
 * Bounded concurrency gate: at most `limit` tasks run at once, at most `maxQueue` wait, and no
 * caller waits longer than `acquireTimeoutMs`.
 *
 * The three bounds exist because an unbounded wait is indistinguishable from a hang: a task that
 * never releases its permit silently parks every later caller forever. Here a stuck permit degrades
 * into a fast, explicit rejection instead.
 *
 * Permit accounting is a hand-off, not a counter dance: releasing to a waiting caller transfers the
 * permit directly (`active` unchanged), and `active` only drops when nobody is waiting. Waiters that
 * already timed out are marked `settled` and skipped, so a permit is never handed to a caller that
 * has stopped listening -- the leak that turns a counting semaphore into a deadlock.
 */

export type ConcurrencyGateRejectionReason = 'timeout' | 'overflow';

export class ConcurrencyGateRejection extends Error {
	constructor(
		readonly reason: ConcurrencyGateRejectionReason,
		readonly gateName: string,
	) {
		super(`Concurrency gate "${gateName}" rejected a task: ${reason}`);
		this.name = 'ConcurrencyGateRejection';
	}
}

export interface ConcurrencyGateOptions {
	name: string;
	limit: number;
	maxQueue: number;
	acquireTimeoutMs: number;
}

interface Waiter {
	settled: boolean;
	grant: () => void;
	fail: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export class ConcurrencyGate {
	private readonly name: string;
	private readonly limit: number;
	private readonly maxQueue: number;
	private readonly acquireTimeoutMs: number;
	private readonly waiters: Waiter[] = [];
	private active = 0;

	constructor(options: ConcurrencyGateOptions) {
		this.name = options.name;
		this.limit = Math.max(1, options.limit);
		this.maxQueue = Math.max(0, options.maxQueue);
		this.acquireTimeoutMs = Math.max(1, options.acquireTimeoutMs);
	}

	async run<T>(task: () => Promise<T>): Promise<T> {
		await this.acquire();
		try {
			return await task();
		} finally {
			this.release();
		}
	}

	get stats(): { active: number; queued: number; limit: number } {
		return { active: this.active, queued: this.waiters.length, limit: this.limit };
	}

	private acquire(): Promise<void> {
		if (this.active < this.limit) {
			this.active++;
			return Promise.resolve();
		}
		if (this.waiters.length >= this.maxQueue) {
			return Promise.reject(new ConcurrencyGateRejection('overflow', this.name));
		}

		return new Promise<void>((resolve, reject) => {
			const waiter: Waiter = {
				settled: false,
				grant: resolve,
				fail: reject,
				timer: setTimeout(() => {
					if (waiter.settled) return;
					waiter.settled = true;
					this.drop(waiter);
					reject(new ConcurrencyGateRejection('timeout', this.name));
				}, this.acquireTimeoutMs),
			};
			waiter.timer.unref?.();
			this.waiters.push(waiter);
		});
	}

	private release(): void {
		while (this.waiters.length > 0) {
			const waiter = this.waiters.shift()!;
			if (waiter.settled) continue;
			waiter.settled = true;
			clearTimeout(waiter.timer);
			waiter.grant();
			return;
		}
		this.active--;
	}

	private drop(waiter: Waiter): void {
		const index = this.waiters.indexOf(waiter);
		if (index !== -1) this.waiters.splice(index, 1);
	}
}
