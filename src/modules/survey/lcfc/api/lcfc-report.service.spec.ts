import { ReportChartService } from 'src/libs/reporting/report-chart.service';
import { LcfcReportService } from './lcfc-report.service';

describe('LcfcReportService', () => {
	it('includes program and course charts in the generated document', async () => {
		const notificationService = {
			getDashboard: jest.fn().mockResolvedValue({
				summary: { completed: 18, pending: 6, total: 24, completionRatePct: 75 },
				byProgram: [
					{
						programName: { es: 'Ingeniería de Software', en: 'Software Engineering' },
						completed: 18,
						pending: 6,
						total: 24,
					},
				],
				byCourse: [
					{
						courseName: { es: 'Arquitectura', en: 'Architecture' },
						sectionCode: 'SI01',
						completed: 10,
						pending: 2,
						total: 12,
					},
				],
			}),
		};
		const reportGenerator = {
			generateDocument: jest
				.fn()
				.mockImplementation(async (document, filename) => ({ document, filename })),
		};
		const service = new LcfcReportService(
			notificationService as never,
			new ReportChartService(),
			reportGenerator as never,
		);

		const result = (await service.generateResultsPdf(5, 7, 'es')) as unknown as {
			document: { bodyHtml: string; programName: string };
		};

		expect(result.document.programName).toBe('Ingeniería de Software');
		expect(result.document.bodyHtml.match(/<svg/g)).toHaveLength(2);
		expect(result.document.bodyHtml).toContain('SI01 - Arquitectura');
		expect(result.document.bodyHtml).toContain('Completadas');
		expect(result.document.bodyHtml).toContain('Pendientes');
	});
});
