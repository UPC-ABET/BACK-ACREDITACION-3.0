/**
 * Arithmetic evaluator for outcome conversion formulas
 * (`accreditation.outcome_conversions.formula`).
 *
 * A formula maps the outcomes of a source commission onto one outcome of a target commission,
 * e.g. `([6] + [7]) / 2` or `(0.5 * [A]) + (0.25 * [I]) + (0.25 * [K])`. It is authored by
 * accreditation staff and stored as text, so it is parsed rather than executed: a hand-written
 * tokenizer plus recursive-descent parser, never `eval`/`Function`, which would let a stored
 * string run arbitrary code inside the grading transaction.
 *
 * Outcome references are written either bracketed (`[OUT_SOFT_01]`, required when the code starts
 * with a digit, e.g. `[6]`) or bare when the code starts with a letter (`A`, `OUT_SOFT_01`).
 * Bare digits are always numeric literals, never references.
 */

export type FormulaScope = Record<string, number>;

export class FormulaError extends Error {}

type Token =
	| { kind: 'number'; value: number }
	| { kind: 'ref'; name: string }
	| { kind: 'op'; value: '+' | '-' | '*' | '/' }
	| { kind: 'paren'; value: '(' | ')' };

const OPERATORS = new Set(['+', '-', '*', '/']);

function tokenize(formula: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;

	while (i < formula.length) {
		const char = formula[i];

		if (/\s/.test(char)) {
			i++;
			continue;
		}

		if (char === '(' || char === ')') {
			tokens.push({ kind: 'paren', value: char });
			i++;
			continue;
		}

		if (OPERATORS.has(char)) {
			tokens.push({ kind: 'op', value: char as '+' | '-' | '*' | '/' });
			i++;
			continue;
		}

		if (char === '[') {
			const end = formula.indexOf(']', i + 1);
			if (end === -1) {
				throw new FormulaError('unclosed outcome reference');
			}
			const name = formula.slice(i + 1, end).trim();
			if (!name) {
				throw new FormulaError('empty outcome reference');
			}
			tokens.push({ kind: 'ref', name });
			i = end + 1;
			continue;
		}

		if (/[0-9.]/.test(char)) {
			let end = i;
			while (end < formula.length && /[0-9.]/.test(formula[end])) end++;
			const raw = formula.slice(i, end);
			const value = Number(raw);
			if (!Number.isFinite(value)) {
				throw new FormulaError(`invalid number "${raw}"`);
			}
			tokens.push({ kind: 'number', value });
			i = end;
			continue;
		}

		if (/[A-Za-z_]/.test(char)) {
			let end = i;
			while (end < formula.length && /[A-Za-z0-9_-]/.test(formula[end])) end++;
			tokens.push({ kind: 'ref', name: formula.slice(i, end) });
			i = end;
			continue;
		}

		throw new FormulaError(`unexpected character "${char}"`);
	}

	return tokens;
}

class Parser {
	private position = 0;

	constructor(
		private readonly tokens: Token[],
		private readonly resolve: (name: string) => number,
	) {}

	parse(): number {
		const value = this.parseExpression();
		if (this.position < this.tokens.length) {
			throw new FormulaError('unexpected trailing tokens');
		}
		return value;
	}

	private peek(): Token | undefined {
		return this.tokens[this.position];
	}

	private parseExpression(): number {
		let left = this.parseTerm();
		for (;;) {
			const token = this.peek();
			if (token?.kind !== 'op' || (token.value !== '+' && token.value !== '-')) return left;
			this.position++;
			const right = this.parseTerm();
			left = token.value === '+' ? left + right : left - right;
		}
	}

	private parseTerm(): number {
		let left = this.parseFactor();
		for (;;) {
			const token = this.peek();
			if (token?.kind !== 'op' || (token.value !== '*' && token.value !== '/')) return left;
			this.position++;
			const right = this.parseFactor();
			if (token.value === '/') {
				if (right === 0) throw new FormulaError('division by zero');
				left = left / right;
			} else {
				left = left * right;
			}
		}
	}

	private parseFactor(): number {
		const token = this.peek();
		if (token?.kind === 'op' && (token.value === '-' || token.value === '+')) {
			this.position++;
			const value = this.parseFactor();
			return token.value === '-' ? -value : value;
		}
		return this.parsePrimary();
	}

	private parsePrimary(): number {
		const token = this.peek();
		if (!token) throw new FormulaError('unexpected end of formula');

		if (token.kind === 'number') {
			this.position++;
			return token.value;
		}

		if (token.kind === 'ref') {
			this.position++;
			return this.resolve(token.name);
		}

		if (token.kind === 'paren' && token.value === '(') {
			this.position++;
			const value = this.parseExpression();
			const closing = this.peek();
			if (closing?.kind !== 'paren' || closing.value !== ')') {
				throw new FormulaError('missing closing parenthesis');
			}
			this.position++;
			return value;
		}

		throw new FormulaError('unexpected token');
	}
}

/**
 * Outcome codes referenced by a formula, in source order and de-duplicated.
 * Used to validate a formula against the source commission's outcomes before storing it,
 * and to decide whether an evaluation carries every input a conversion needs.
 */
export function extractFormulaReferences(formula: string): string[] {
	const names = tokenize(formula)
		.filter((token): token is Extract<Token, { kind: 'ref' }> => token.kind === 'ref')
		.map((token) => token.name);
	return [...new Set(names)];
}

/** Throws FormulaError when the formula is not parseable. Reference names are not checked here. */
export function assertValidFormula(formula: string): void {
	new Parser(tokenize(formula), () => 1).parse();
}

/**
 * Evaluates a formula against a scope of source outcome grades.
 * Throws FormulaError when a referenced outcome is absent from the scope: a conversion computed
 * from a partial input vector would silently understate the student's grade.
 */
export function evaluateFormula(formula: string, scope: FormulaScope): number {
	const resolve = (name: string): number => {
		const value = scope[name];
		if (value === undefined || value === null || !Number.isFinite(value)) {
			throw new FormulaError(`unresolved outcome reference "${name}"`);
		}
		return value;
	};

	const result = new Parser(tokenize(formula), resolve).parse();
	if (!Number.isFinite(result)) {
		throw new FormulaError('formula did not produce a finite result');
	}
	return result;
}
