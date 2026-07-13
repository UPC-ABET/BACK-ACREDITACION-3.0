import {
	assertValidFormula,
	evaluateFormula,
	extractFormulaReferences,
	FormulaError,
} from './formula.functions';

describe('formula.functions', () => {
	describe('evaluateFormula', () => {
		it('resolves a single bracketed reference', () => {
			expect(evaluateFormula('[6]', { '6': 15 })).toBe(15);
		});

		it('resolves a bare reference starting with a letter', () => {
			expect(evaluateFormula('A', { A: 12 })).toBe(12);
		});

		it('averages two outcomes (legacy CAC B = (B + E) / 2)', () => {
			expect(evaluateFormula('([B] + [E]) / 2', { B: 10, E: 20 })).toBe(15);
		});

		it('applies a weighted formula (legacy CAC J)', () => {
			const scope = { A: 20, I: 10, K: 8 };
			expect(evaluateFormula('(0.5 * [A]) + (0.25 * [I]) + (0.25 * [K])', scope)).toBe(14.5);
		});

		it('honours operator precedence without parentheses', () => {
			expect(evaluateFormula('[A] + [B] * 2', { A: 1, B: 3 })).toBe(7);
		});

		it('supports unary minus', () => {
			expect(evaluateFormula('-[A] + 10', { A: 4 })).toBe(6);
		});

		it('treats bare digits as numeric literals, not references', () => {
			expect(evaluateFormula('[A] * 2', { A: 5, '2': 999 })).toBe(10);
		});

		it('throws when a referenced outcome is missing from the scope', () => {
			expect(() => evaluateFormula('([B] + [E]) / 2', { B: 10 })).toThrow(FormulaError);
		});

		it('throws on division by zero', () => {
			expect(() => evaluateFormula('[A] / 0', { A: 10 })).toThrow(FormulaError);
		});

		it('never executes injected code', () => {
			expect(() => evaluateFormula('process.exit(1)', {})).toThrow(FormulaError);
		});
	});

	describe('extractFormulaReferences', () => {
		it('lists referenced outcome codes without duplicates', () => {
			expect(extractFormulaReferences('([A] + [B]) / 2 + [A]')).toEqual(['A', 'B']);
		});

		it('ignores numeric literals', () => {
			expect(extractFormulaReferences('(0.5 * [A]) + 0.25')).toEqual(['A']);
		});
	});

	describe('assertValidFormula', () => {
		it('accepts a well-formed formula', () => {
			expect(() => assertValidFormula('([6] + [7]) / 2')).not.toThrow();
		});

		it('rejects an unbalanced parenthesis', () => {
			expect(() => assertValidFormula('([6] + [7] / 2')).toThrow(FormulaError);
		});

		it('rejects an unclosed reference', () => {
			expect(() => assertValidFormula('[6 + 7')).toThrow(FormulaError);
		});

		it('rejects a dangling operator', () => {
			expect(() => assertValidFormula('[6] +')).toThrow(FormulaError);
		});
	});
});
