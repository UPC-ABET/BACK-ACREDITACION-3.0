import { camelToSnake, camelizeKeys, snakeToCamel, snakeizeKeys } from './case.functions';

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

describe('camelToSnake', () => {
	it('converts camelCase to snake_case', () => {
		expect(camelToSnake('isEvaluable')).toBe('is_evaluable');
		expect(camelToSnake('courseLearningOutcome')).toBe('course_learning_outcome');
	});

	it('leaves already-snake_case and single-word keys unchanged', () => {
		expect(camelToSnake('is_evaluable')).toBe('is_evaluable');
		expect(camelToSnake('value')).toBe('value');
	});
});

describe('snakeizeKeys', () => {
	it('snake-izes keys recursively through objects and arrays', () => {
		const input = { surveyType: 'GRA', nested: [{ programId: 1 }, { isVisible: true }] };
		expect(snakeizeKeys(input)).toEqual({
			survey_type: 'GRA',
			nested: [{ program_id: 1 }, { is_visible: true }],
		});
	});

	it('is idempotent and inverse to camelizeKeys', () => {
		const camel = { useEvaluation: true, extra: { nameEn: 'x' } };
		const snake = snakeizeKeys(camel);
		expect(snake).toEqual({ use_evaluation: true, extra: { name_en: 'x' } });
		expect(snakeizeKeys(snake)).toEqual(snake);
		expect(camelizeKeys(snake)).toEqual(camel);
	});

	it('leaves primitives, null, and Date untouched', () => {
		const date = new Date('2026-05-31T00:00:00.000Z');
		expect(snakeizeKeys(null)).toBeNull();
		expect(snakeizeKeys('aValue')).toBe('aValue');
		expect(snakeizeKeys(date)).toBe(date);
	});
});
