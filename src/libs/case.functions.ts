/**
 * Case-normalization helpers for the JSONB <-> wire boundary.
 *
 * Postgres columns are snake_case and TypeORM's `SnakeNamingStrategy` bridges
 * the top-level column names to camelCase TS properties. It does NOT, however,
 * reach inside a JSONB blob: the keys stored *within* a `@JsonColumn` value
 * stay exactly as they were written to the DB (snake_case). These helpers
 * normalize that nested content to the camelCase wire convention so generic
 * read paths don't have to hand-map every field.
 */

const SNAKE_SEGMENT = /_+([a-z0-9])/g;

/** Convert a single snake_case key to camelCase. Already-camelCase keys are returned unchanged. */
export function snakeToCamel(key: string): string {
	return key.replace(SNAKE_SEGMENT, (_match, char: string) => char.toUpperCase());
}

/**
 * Recursively convert every object key from snake_case to camelCase.
 *
 * - Arrays are mapped element-wise.
 * - Plain objects have their keys converted and their values recursed into.
 * - Primitives, `Date`, and class instances (non-plain objects) are returned untouched.
 */
export function camelizeKeys<T = unknown>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => camelizeKeys(item)) as unknown as T;
	}

	if (isPlainObject(value)) {
		const result: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
			result[snakeToCamel(key)] = camelizeKeys(nested);
		}
		return result as unknown as T;
	}

	return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || value instanceof Date) {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
