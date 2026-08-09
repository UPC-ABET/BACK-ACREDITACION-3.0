import { GraReportService } from './gra-report.service';

describe('GraReportService', () => {
	it('builds a per-career table with a grand-total row', async () => {
		const notificationService = {
			getProgramSummary: jest.fn().mockResolvedValue({
				periodCode: '202610',
				rows: [
					{
						programId: 1,
						programName: { es: 'Ingenieria de Software', en: 'Software Engineering' },
						completed: 907,
						pending: 4792,
						total: 5699,
					},
					{
						programId: 2,
						programName: { es: 'Ingenieria Civil', en: 'Civil Engineering' },
						completed: 1446,
						pending: 9363,
						total: 10809,
					},
				],
			}),
		};
		const reportGenerator = {
			generateDocument: jest.fn().mockImplementation(async (document, filename) => ({
				pdf: Buffer.from('pdf'),
				document,
				filename,
			})),
		};
		const service = new GraReportService(notificationService as never, reportGenerator as never);

		const result = (await service.generateProgramSummaryPdf(1, 'es')) as unknown as {
			document: { bodyHtml: string; reportName: string };
			filename: string;
		};

		expect(result.document.reportName).toBe('Reporte General GRA por Carrera');
		expect(result.document.bodyHtml).toContain('Ingenieria Civil');
		expect(result.document.bodyHtml).toContain('Ingenieria de Software');
		expect(result.document.bodyHtml).toContain('Total Encuestas');
		expect(result.document.bodyHtml).toContain('Avance');
		// Grand total row: 5699 + 10809 = 16508, completed 907 + 1446 = 2353
		expect(result.document.bodyHtml).toContain('16508');
		expect(result.document.bodyHtml).toContain('2353');
		expect(result.document.bodyHtml).toContain('TOTAL');
	});
});
