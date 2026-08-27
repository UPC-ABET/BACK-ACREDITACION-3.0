import { ReportChartService } from 'src/libs/reporting/report-chart.service';
import { LcfcReportService } from './lcfc-report.service';

describe('LcfcReportService', () => {
	function buildService() {
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
						courseCode: 'CC47',
						sectionCode: 'SI01',
						professorName: 'Victor Parasi',
						enrolled: 29,
						completed: 10,
						pending: 2,
						total: 12,
					},
					{
						courseName: { es: 'Arquitectura', en: 'Architecture' },
						courseCode: 'CC47',
						sectionCode: 'SI02',
						professorName: 'Ana Torres',
						enrolled: 15,
						completed: 5,
						pending: 1,
						total: 6,
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
		return service;
	}

	it('includes program and course charts, broken down per NRC by default', async () => {
		const service = buildService();

		const result = (await service.generateResultsPdf(5, 7, 'es')) as unknown as {
			document: { bodyHtml: string; programName: string };
		};

		expect(result.document.programName).toBe('Ingeniería de Software');
		expect(result.document.bodyHtml.match(/<svg/g)).toHaveLength(2);
		expect(result.document.bodyHtml).toContain('SI01 - Arquitectura');
		expect(result.document.bodyHtml).toContain('Completadas');
		expect(result.document.bodyHtml).toContain('Pendientes');
		expect(result.document.bodyHtml).toContain('CC47');
		expect(result.document.bodyHtml).toContain('Victor Parasi');
		expect(result.document.bodyHtml).toContain('SI01');
		expect(result.document.bodyHtml).toContain('SI02');
	});

	it('aggregates by course and omits professor/section when groupBy is "course"', async () => {
		const service = buildService();

		const result = (await service.generateResultsPdf(5, 7, 'es', 'course')) as unknown as {
			document: { bodyHtml: string };
		};

		expect(result.document.bodyHtml).toContain('CC47');
		expect(result.document.bodyHtml).not.toContain('Victor Parasi');
		expect(result.document.bodyHtml).not.toContain('SI01');
		expect(result.document.bodyHtml).not.toContain('SI02');
		// Enrolled/completed/pending summed across both sections (29+15, 10+5, 2+1).
		expect(result.document.bodyHtml).toContain('<td class="num">44</td>');
		expect(result.document.bodyHtml).toContain('<td class="num">15</td>');
		expect(result.document.bodyHtml).toContain('<td class="num">3</td>');
	});
});
