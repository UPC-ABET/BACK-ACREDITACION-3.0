import { unwrapBase64Body } from './planner-wire.functions';

const wrap = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf-8').toString('base64');

describe('unwrapBase64Body', () => {
	it('decodes a base64-wrapped object', () => {
		const payload = { status: false, message: 'Usuario o clave incorrectos!' };

		expect(unwrapBase64Body(wrap(payload))).toEqual(payload);
	});

	it.each([
		['an object', { status: true }],
		['an array', [1, 2]],
		['null', null],
		['a number', 42],
		['undefined', undefined],
	])('passes %s through untouched', (_label, value) => {
		expect(unwrapBase64Body(value)).toEqual(value);
	});

	/**
	 * `Buffer.from(s, 'base64')` never throws — it drops anything outside the alphabet — so these
	 * all decode to something. Returning the original string is what keeps them inside the
	 * caller's existing non-object guard instead of throwing a raw SyntaxError past it.
	 */
	it.each([
		['plain text', 'service temporarily unavailable'],
		['an empty string', ''],
		['base64 of something that is not JSON', Buffer.from('nope').toString('base64')],
	])('returns %s unchanged when it does not decode to JSON', (_label, value) => {
		expect(unwrapBase64Body(value)).toBe(value);
	});

	// The unwrap is single-level by design: the caller's own guard decides what to do with a
	// string, and no observed u-planner response wraps twice.
	it('unwraps one level only', () => {
		expect(unwrapBase64Body(wrap(wrap({ status: true })))).toBe(wrap({ status: true }));
	});

	// A scalar decodes and parses cleanly, so only the caller's is-it-an-object guard rejects it.
	it('returns a decoded scalar rather than an object', () => {
		expect(unwrapBase64Body(Buffer.from('42').toString('base64'))).toBe(42);
	});
});
