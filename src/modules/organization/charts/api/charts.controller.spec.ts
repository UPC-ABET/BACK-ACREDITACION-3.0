import { ChartController } from './charts.controller';
import { ChartService } from './charts.service';

describe('ChartController.maintenanceResetPasswords', () => {
	let controller: ChartController;
	let service: { resetMaintenancePasswords: jest.Mock };

	beforeEach(() => {
		service = {
			resetMaintenancePasswords: jest.fn(),
		};
		controller = new ChartController(service as unknown as ChartService);
	});

	it('delegates to the service with the header-derived scope and the DTO entity types', async () => {
		const result = { reset: [], skipped: [] };
		service.resetMaintenancePasswords.mockResolvedValueOnce(result);

		const response = await controller.maintenanceResetPasswords(100, 7, {
			entityTypeCodes: ['TG903-T002', 'TG903-T003'],
		});

		expect(service.resetMaintenancePasswords).toHaveBeenCalledWith(100, 7, [
			'TG903-T002',
			'TG903-T003',
		]);
		expect(response.data).toBe(result);
	});
});
