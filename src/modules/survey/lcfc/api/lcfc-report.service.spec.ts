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
						campusName: { es: 'Campus Lima', en: 'Lima Campus' },
						modalityName: { es: 'Presencial', en: 'On-site' },
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
						campusName: { es: 'Campus Monterrico', en: 'Monterrico Campus' },
						modalityName: { es: 'Virtual', en: 'Virtual' },
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
		const service = new LcfcReportService(notificationService as never, reportGenerator as never);
		return service;
	}

	it('breaks down per NRC by default, with professor/campus/modality columns and no charts', async () => {
		const service = buildService();

		const result = (await service.generateResultsPdf(5, 7, 'es')) as unknown as {
			document: { bodyHtml: string; programName: string };
		};

		expect(result.document.programName).toBe('Ingeniería de Software');
		expect(result.document.bodyHtml).not.toContain('<svg');
		expect(result.document.bodyHtml).toContain('Completadas');
		expect(result.document.bodyHtml).toContain('Pendientes');
		expect(result.document.bodyHtml).toContain('CC47');
		expect(result.document.bodyHtml).toContain('Victor Parasi');
		expect(result.document.bodyHtml).toContain('SI01');
		expect(result.document.bodyHtml).toContain('SI02');
		expect(result.document.bodyHtml).toContain('Campus Lima');
		expect(result.document.bodyHtml).toContain('Campus Monterrico');
		expect(result.document.bodyHtml).toContain('Presencial');
		expect(result.document.bodyHtml).toContain('Virtual');
		// Completed/pending now show their share of that row's total, 2 decimals.
		expect(result.document.bodyHtml).toContain('10 (83.33%)');
		expect(result.document.bodyHtml).toContain('2 (16.67%)');
	});

	it('aggregates by course and omits professor/section/campus/modality when groupBy is "course"', async () => {
		const service = buildService();

		const result = (await service.generateResultsPdf(5, 7, 'es', 'course')) as unknown as {
			document: { bodyHtml: string };
		};

		expect(result.document.bodyHtml).toContain('CC47');
		expect(result.document.bodyHtml).not.toContain('Victor Parasi');
		expect(result.document.bodyHtml).not.toContain('SI01');
		expect(result.document.bodyHtml).not.toContain('SI02');
		expect(result.document.bodyHtml).not.toContain('Campus Lima');
		expect(result.document.bodyHtml).not.toContain('Presencial');
		// Enrolled/completed/pending summed across both sections (29+15, 10+5, 2+1 of 12+6 total).
		expect(result.document.bodyHtml).toContain('<td class="num">44</td>');
		expect(result.document.bodyHtml).toContain('15 (83.33%)');
		expect(result.document.bodyHtml).toContain('3 (16.67%)');
	});

	it('omits the by-course table entirely when hideCourseBreakdown is set', async () => {
		const service = buildService();

		const result = (await service.generateResultsPdf(
			5,
			7,
			'es',
			'section',
			undefined,
			undefined,
			true,
		)) as unknown as {
			document: { bodyHtml: string };
		};

		expect(result.document.bodyHtml).not.toContain('CC47');
		expect(result.document.bodyHtml).not.toContain('SI01');
	});
});
