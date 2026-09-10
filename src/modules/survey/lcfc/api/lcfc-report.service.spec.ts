import { LcfcReportService } from './lcfc-report.service';

/** A count cell as the shared survey table renders it: the count, its share on its own line. */
const countCell = (count: number, percent: string) =>
	`${count}<span class="count-share">(${percent}%)</span>`;

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
		expect(result.document.bodyHtml).toContain(countCell(10, '83.33'));
		expect(result.document.bodyHtml).toContain(countCell(2, '16.67'));
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
		expect(result.document.bodyHtml).toContain(countCell(15, '83.33'));
		expect(result.document.bodyHtml).toContain(countCell(3, '16.67'));
	});

	it('closes both completion tables with a weighted TOTAL row', async () => {
		const service = buildService();

		const result = (await service.generateResultsPdf(5, 7, 'es')) as unknown as {
			document: { bodyHtml: string };
		};

		const footers = [...result.document.bodyHtml.matchAll(/<tfoot>([\s\S]*?)<\/tfoot>/g)].map(
			(match) => [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].trim()),
		);

		// By program: the single row, restated as a total.
		expect(footers[0]).toEqual([
			'TOTAL',
			countCell(18, '75.00'),
			countCell(6, '25.00'),
			'24',
			'75%',
		]);
		// By NRC: 29+15 enrolled, 10+5 completed and 2+1 pending of 12+6, with the percentages
		// recomputed against that grand total rather than carried over from either row.
		expect(footers[1]).toEqual([
			'TOTAL',
			'44',
			countCell(15, '83.33'),
			countCell(3, '16.67'),
			'18',
			'83%',
		]);
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
