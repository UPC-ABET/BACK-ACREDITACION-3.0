/**
 * Wraps `p-limit`'s dynamic import behind a regular module so callers stay unit-testable —
 * `p-limit` is ESM-only, and with this project's `module: nodenext`, TypeScript preserves
 * `await import('p-limit')` as a real dynamic import instead of downleveling it to `require`.
 * Jest's CJS transform can't intercept that directly, but it CAN mock this whole module.
 */
export async function createConcurrencyLimiter(
	concurrency: number,
): Promise<<T>(fn: () => Promise<T>) => Promise<T>> {
	const pLimitMod = await import('p-limit');
	const pLimit = (pLimitMod.default ?? pLimitMod) as (
		limit: number,
	) => <T>(fn: () => Promise<T>) => Promise<T>;
	return pLimit(concurrency);
}
