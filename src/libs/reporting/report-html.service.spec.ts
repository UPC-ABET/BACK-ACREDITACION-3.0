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
		// The banner names the report alone; the program moves into the metadata row.
		expect(html).toContain('>Reporte de control por Outcome</h2>');
		expect(html).not.toContain('Reporte de control por Outcome — Ingeniería de Software');
		expect(html).toContain('Carrera');
		expect(html).toContain('Ingeniería de Software');
		expect(html).toContain('202520');
		expect(html).toContain('—');
		expect(html).toContain('A4 landscape');
		expect(html).toContain('<section id="custom-content">Module content</section>');
	});

	it('leaves the metadata row alone when the module lists the career itself', () => {
		const html = service.build({
			language: 'es',
			reportName: 'Reporte de Semáforo',
			programName: '',
			metadata: [{ label: 'Carrera', value: 'Ingeniería de Software' }],
			bodyHtml: '',
		});

		expect(html.match(/Ingeniería de Software/g)).toHaveLength(1);
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
		expect(html).toContain('A &amp; B');
		expect(html).toContain('Program');
		expect(html).toContain('&quot;Software&quot;');
		expect(html).toContain('<p>Trusted module HTML</p>');
	});

	it('shrinks the title font size so a long report name still fits on one line', () => {
		const shortTitle = service.build({
			language: 'es',
			reportName: 'Informe',
			programName: 'Software',
			bodyHtml: '',
		});
		// Only the report name drives the fit now -- the program sits in the metadata row.
		const longTitle = service.build({
			language: 'es',
			reportName: 'Informe de Percepción por Outcome LCFC por Curso y Docente',
			programName: 'Ingeniería de Gestión Minera y Metalúrgica Aplicada',
			bodyHtml: '',
		});

		expect(shortTitle).toContain('<h2 style="font-size:17pt">');
		expect(longTitle).toContain('Ingeniería de Gestión Minera y Metalúrgica Aplicada');
		expect(fontSizeOf(longTitle, 'h2')).toBeLessThan(17);
		expect(fontSizeOf(longTitle, 'h2')).toBeGreaterThanOrEqual(9);
	});
});

function fontSizeOf(html: string, tag: string): number {
	const match = new RegExp(`<${tag} style="font-size:([\\d.]+)pt"`).exec(html);
	return match ? Number(match[1]) : Number.NaN;
}
