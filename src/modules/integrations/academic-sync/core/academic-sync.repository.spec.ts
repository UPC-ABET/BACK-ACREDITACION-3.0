import { CommissionOption, pickPreferredCommission } from './academic-sync.repository';

function commission(id: number, code: string): CommissionOption {
	return {
		id,
		code,
		name: { es: `Comision ${code}`, en: `${code} Commission` },
		programCommissionId: id * 100,
	};
}

describe('pickPreferredCommission', () => {
	it('returns null when there are no commissions', () => {
		expect(pickPreferredCommission([])).toBeNull();
	});

	it('returns the only commission when there is exactly one', () => {
		const only = commission(1, 'ABC');
		expect(pickPreferredCommission([only])).toEqual(only);
	});

	it('prefers the commission coded EAC over any other, regardless of order', () => {
		const eac = commission(2, 'EAC');
		const other = commission(1, 'ABC');
		expect(pickPreferredCommission([other, eac])).toEqual(eac);
		expect(pickPreferredCommission([eac, other])).toEqual(eac);
	});

	it('falls back to the first commission alphabetically by code when there is no EAC', () => {
		const b = commission(2, 'BBB');
		const a = commission(1, 'AAA');
		const c = commission(3, 'CCC');
		expect(pickPreferredCommission([b, c, a])).toEqual(a);
	});

	it('does not treat a lowercase "eac" as a case-insensitive match for EAC', () => {
		// If the match were case-insensitive, this would short-circuit to `lowercaseEac`. Instead it
		// must fall through to the alphabetical tie-break, which puts 'AAA' first.
		const lowercaseEac = commission(1, 'eac');
		const alphabeticallyFirst = commission(2, 'AAA');
		expect(pickPreferredCommission([lowercaseEac, alphabeticallyFirst])).toEqual(
			alphabeticallyFirst,
		);
	});
});
