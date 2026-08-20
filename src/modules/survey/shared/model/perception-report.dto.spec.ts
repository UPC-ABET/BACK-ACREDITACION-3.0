import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PerceptionReportDto } from './perception-report.dto';

async function errorsFor(payload: Record<string, unknown>) {
	const dto = plainToInstance(PerceptionReportDto, payload);
	return validate(dto);
}

describe('PerceptionReportDto', () => {
	it('rejects programId without commissionId', async () => {
		const errors = await errorsFor({ programId: 1 });
		expect(errors.some((e) => e.property === 'commissionId')).toBe(true);
	});

	it('accepts programId together with commissionId', async () => {
		const errors = await errorsFor({ programId: 1, commissionId: 2 });
		expect(errors.some((e) => e.property === 'commissionId')).toBe(false);
	});

	it('accepts campusId alone without programId or commissionId', async () => {
		const errors = await errorsFor({ campusId: 3 });
		expect(errors.some((e) => e.property === 'commissionId')).toBe(false);
	});

	it('accepts an empty filter (no programId, no commissionId)', async () => {
		const errors = await errorsFor({});
		expect(errors).toHaveLength(0);
	});
});
