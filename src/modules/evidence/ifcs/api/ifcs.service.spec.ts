import { DataSource } from 'typeorm';
import { IfcService } from './ifcs.service';
import { IfcRepository } from '../core/ifcs.repository';
import { ListIfcsDto } from '../model/ifcs.dtos';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

describe('IfcService.list', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock };
	const repository = {} as IfcRepository;

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		service = new IfcService(repository, dataSource as unknown as DataSource);
	});

	it('forwards chart_ids, period_id, and the COURSE type code to the SQL query', async () => {
		const expected = [
			{ chart_id: 310, course_code: 'CRS_FUND_PROG', ifc: null },
			{ chart_id: 311, course_code: 'CRS_REQ_ENG', ifc: { id: 1, status_code: 'TG701-T001' } },
		];
		dataSource.query.mockResolvedValueOnce(expected);

		const dto: ListIfcsDto = { chart_ids: [310, 311], period_id: 5 };
		const result = await service.list(dto);

		expect(result).toBe(expected);
		expect(dataSource.query).toHaveBeenCalledTimes(1);
		const [, params] = dataSource.query.mock.calls[0];
		expect(params).toEqual([[310, 311], 5, TYPE_CODES.ENTITY_TYPE.COURSE]);
	});

	it('returns whatever the DataSource returns (passthrough)', async () => {
		dataSource.query.mockResolvedValueOnce([]);

		const result = await service.list({ chart_ids: [1], period_id: 1 });

		expect(result).toEqual([]);
	});
});
