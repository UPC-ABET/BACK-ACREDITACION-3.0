import { camelizeKeys, snakeToCamel } from './case.functions';

describe('snakeToCamel', () => {
	it('converts snake_case to camelCase', () => {
		expect(snakeToCamel('valid_status_codes')).toBe('validStatusCodes');
		expect(snakeToCamel('course_learning_outcome')).toBe('courseLearningOutcome');
	});

	it('leaves already-camelCase and single-word keys unchanged', () => {
		expect(snakeToCamel('surveyId')).toBe('surveyId');
		expect(snakeToCamel('value')).toBe('value');
	});

	it('collapses repeated and trailing-digit segments', () => {
		expect(snakeToCamel('field_1_value')).toBe('field1Value');
	});
});

describe('camelizeKeys', () => {
	it('camelizes keys of a plain object', () => {
		expect(camelizeKeys({ valid_status_codes: null, var: '{{course_name}}' })).toEqual({
			validStatusCodes: null,
			var: '{{course_name}}',
		});
	});

	it('recurses into nested objects and arrays', () => {
		const input = {
			outer_key: [{ inner_key: 1 }, { another_inner: { deep_key: 'x' } }],
		};
		expect(camelizeKeys(input)).toEqual({
			outerKey: [{ innerKey: 1 }, { anotherInner: { deepKey: 'x' } }],
		});
	});

	it('is a no-op for an I18nText blob (already camelCase)', () => {
		expect(camelizeKeys({ es: 'Hola', en: 'Hi' })).toEqual({ es: 'Hola', en: 'Hi' });
	});

	it('leaves primitives, null, and Date untouched', () => {
		const date = new Date('2026-05-31T00:00:00.000Z');
		expect(camelizeKeys(null)).toBeNull();
		expect(camelizeKeys(42)).toBe(42);
		expect(camelizeKeys('a_b')).toBe('a_b');
		expect(camelizeKeys(date)).toBe(date);
	});

	it('does not mutate the original object', () => {
		const input = { snake_key: { nested_key: 1 } };
		const output = camelizeKeys(input);
		expect(input).toEqual({ snake_key: { nested_key: 1 } });
		expect(output).not.toBe(input);
	});
});
