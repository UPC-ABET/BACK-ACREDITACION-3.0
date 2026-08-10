/**
 * u-planner answers from two code paths with two different envelopes. Its input-validation path
 * returns a plain JSON object; its LDAP path — the one every real login reaches, whatever the
 * verdict — returns the payload base64-encoded *inside* a JSON string (`"eyJzdGF0dXMi..."`), so
 * `JSON.parse` yields a string rather than the body. Both shapes were captured live on 2026-08-09
 * from `upc-e2g-post-api.u-planner.com`, which serves the login and the data API alike — hence a
 * shared helper rather than a copy in each client, so the two cannot drift to different answers
 * about the same host.
 *
 * Unwrapping one level is what lets a caller's guards see the payload at all. Left wrapped, a
 * login rejection reads as a malformed response — a wrong password reported as "u-planner is
 * down" — and a data response reads as zero records.
 *
 * The decoded bytes must parse as JSON before they are believed. `Buffer.from(s, 'base64')`
 * discards anything outside the alphabet instead of throwing, so every string decodes to
 * something; an unguarded parse of a WAF's plain-text answer would throw a raw SyntaxError that
 * escapes the caller's classification entirely. Returning the value untouched instead routes it
 * into whatever guard the caller already applies to a non-object body.
 *
 * One level only, deliberately. A doubly-wrapped payload stays a string and is refused.
 */
export const unwrapBase64Body = (value: unknown): unknown => {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(Buffer.from(value, 'base64').toString('utf-8'));
	} catch {
		return value;
	}
};
