import { ReportHtmlService } from './report-html.service';

describe('ReportHtmlService', () => {
	const service = new ReportHtmlService();

	it('builds the shared report shell and preserves the module body', () => {
		const html = service.build({
			language: 'es',
			reportName: 'Reporte de control por Outcome',
			programName: 'Ingeniería de Software',
			metadata: [
				{ label: 'Ciclo', value: '202520' },
				{ label: 'Sede', value: null },
			],
			bodyHtml: '<section id="custom-content">Module content</section>',
			orientation: 'landscape',
		});

		expect(html).toContain('report-header__primary');
		expect(html).toContain('UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS');
		expect(html).toContain('Reporte de control por Outcome — Ingeniería de Software');
		expect(html).toContain('202520');
		expect(html).toContain('—');
		expect(html).toContain('A4 landscape');
		expect(html).toContain('<section id="custom-content">Module content</section>');
	});

	it('escapes header and metadata values', () => {
		const html = service.build({
			language: 'en',
			reportName: '<Report>',
			programName: 'A & B',
			metadata: [{ label: 'Program', value: '"Software"' }],
			bodyHtml: '<p>Trusted module HTML</p>',
		});

		expect(html).toContain('&lt;Report&gt;');
		expect(html).toContain('&lt;Report&gt; — A &amp; B');
		expect(html).toContain('&quot;Software&quot;');
		expect(html).toContain('<p>Trusted module HTML</p>');
	});
});
