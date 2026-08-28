import { ReportChartService } from './report-chart.service';

describe('ReportChartService', () => {
	const service = new ReportChartService();

	it('builds an inline grouped bar chart with values and legend', () => {
		const html = service.buildGroupedBarChart({
			title: 'Survey progress',
			categories: ['Software', 'Systems'],
			series: [
				{ label: 'Completed', color: '#16a34a', values: [12, 8] },
				{ label: 'Pending', color: '#e30613', values: [3, 4] },
			],
			yAxisLabel: 'Surveys',
		});

		expect(html).toContain('<svg');
		expect(html).toContain('Survey progress');
		expect(html).toContain('Software');
		expect(html).toContain('Completed');
		expect(html).toContain('12');
		expect(html).toContain('#16a34a');
		expect(html).toContain('>15<');
		expect(html).not.toContain('rotate(-35)');
		expect(html).toContain('<tspan');
	});

	it('wraps long category names into horizontal lines', () => {
		const html = service.buildGroupedBarChart({
			categories: ['Ingeniería de Sistemas de Información'],
			series: [{ label: 'Completed', color: '#16a34a', values: [10] }],
		});

		expect(html).toContain('Ingeniería de');
		expect(html).toContain('Sistemas de');
		expect(html).toContain('Información');
		expect(html).toContain('text-anchor="middle"');
	});

	it('returns an empty state when there are no categories', () => {
		const html = service.buildGroupedBarChart({
			categories: [],
			series: [],
			emptyLabel: 'No data',
		});

		expect(html).toContain('report-chart--empty');
		expect(html).toContain('No data');
	});

	it('renders exactly one bar per category (not one per series) when singleBarPerCategory is set', () => {
		const html = service.buildGroupedBarChart({
			categories: ['1', '2', '3'],
			series: [
				{ label: 'Necesita mejora', color: '#e30613', values: [4, 0, 0] },
				{ label: 'Esperado', color: '#f4c20d', values: [0, 6, 0] },
				{ label: 'Sobresaliente', color: '#16a34a', values: [0, 0, 9] },
			],
			xAxisLabel: 'Respuestas',
			singleBarPerCategory: true,
		});

		// 3 category bars + 3 legend swatches (one per series) — not 3 categories x 3 series = 9.
		expect((html.match(/<rect/g) ?? []).length).toBe(6);
		expect(html).toContain('#e30613');
		expect(html).toContain('#f4c20d');
		expect(html).toContain('#16a34a');
		expect(html).toContain('Respuestas');
		// Legend still lists all three bands even though each category shows only one bar.
		expect(html).toContain('Necesita mejora');
		expect(html).toContain('Esperado');
		expect(html).toContain('Sobresaliente');
	});

	it('escapes chart labels and colors', () => {
		const html = service.buildGroupedBarChart({
			title: '<Report>',
			categories: ['A & B'],
			series: [{ label: '"Completed"', color: 'red" onload="alert(1)', values: [1] }],
		});

		expect(html).toContain('&lt;Report&gt;');
		expect(html).toContain('A &amp; B');
		expect(html).toContain('&quot;Completed&quot;');
		expect(html).not.toContain('onload="alert(1)"');
	});
});
