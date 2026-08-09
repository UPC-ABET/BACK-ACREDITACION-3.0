const MAX_CAUSE_DEPTH = 4;

/**
 * One format for "what went wrong", for log lines and diagnostic messages.
 *
 * The chain is walked because that is where the information usually is: undici reports DNS, TLS, a
 * refused connection and a blocked redirect all as `TypeError: fetch failed`, and only `cause`
 * distinguishes them. Several ad-hoc versions of this drifted into four different shapes and two
 * different fallback strings, which meant one class of failure needed four log greps to find.
 *
 * Errors only — never pass a request or a response body through this.
 */
export const describeError = (error: unknown): string => {
	if (!(error instanceof Error)) return 'unknown error';

	const chain: string[] = [];
	let current: unknown = error;
	while (current instanceof Error && chain.length < MAX_CAUSE_DEPTH) {
		chain.push(`${current.name}: ${current.message}`);
		current = current.cause;
	}
	return chain.join(' <- ');
};
