import { ConcurrencyGate, ConcurrencyGateRejection } from './concurrency-gate';

const deferred = () => {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ConcurrencyGate', () => {
	const gateOf = (overrides: Partial<ConstructorParameters<typeof ConcurrencyGate>[0]> = {}) =>
		new ConcurrencyGate({
			name: 'test',
			limit: 2,
			maxQueue: 10,
			acquireTimeoutMs: 1_000,
			...overrides,
		});

	it('runs up to the limit concurrently and queues the rest', async () => {
		const gate = gateOf();
		const gates = [deferred(), deferred(), deferred()];
		const started: number[] = [];

		const runs = gates.map((d, index) =>
			gate.run(async () => {
				started.push(index);
				await d.promise;
			}),
		);

		await flush();
		expect(started).toEqual([0, 1]);
		expect(gate.stats).toEqual({ active: 2, queued: 1, limit: 2 });

		gates[0].resolve();
		await flush();
		expect(started).toEqual([0, 1, 2]);

		gates[1].resolve();
		gates[2].resolve();
		await Promise.all(runs);
		expect(gate.stats).toEqual({ active: 0, queued: 0, limit: 2 });
	});

	it('releases the permit when the task throws', async () => {
		const gate = gateOf({ limit: 1 });

		await expect(gate.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
		expect(gate.stats.active).toBe(0);

		await expect(gate.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
	});

	it('rejects with a timeout instead of waiting forever on a stuck task', async () => {
		const gate = gateOf({ limit: 1, acquireTimeoutMs: 20 });
		const stuck = deferred();
		const held = gate.run(() => stuck.promise);

		await expect(gate.run(() => Promise.resolve('never'))).rejects.toMatchObject({
			reason: 'timeout',
		});

		stuck.resolve();
		await held;
	});

	it('rejects immediately once the queue is full', async () => {
		const gate = gateOf({ limit: 1, maxQueue: 1 });
		const stuck = deferred();
		const held = gate.run(() => stuck.promise);
		const queued = gate.run(() => Promise.resolve('queued'));

		await flush();
		await expect(gate.run(() => Promise.resolve('overflow'))).rejects.toMatchObject({
			reason: 'overflow',
		});

		stuck.resolve();
		await held;
		await queued;
	});

	/**
	 * The regression that deadlocked exports: a permit handed to a caller that already gave up was
	 * counted as in use forever, so the gate drained to zero capacity one timeout at a time.
	 */
	it('does not leak a permit to a waiter that already timed out', async () => {
		const gate = gateOf({ limit: 1, acquireTimeoutMs: 20 });
		const stuck = deferred();
		const held = gate.run(() => stuck.promise);

		await expect(gate.run(() => Promise.resolve('abandoned'))).rejects.toBeInstanceOf(
			ConcurrencyGateRejection,
		);

		stuck.resolve();
		await held;

		expect(gate.stats).toEqual({ active: 0, queued: 0, limit: 1 });
		await expect(gate.run(() => Promise.resolve('recovered'))).resolves.toBe('recovered');
	});
});
