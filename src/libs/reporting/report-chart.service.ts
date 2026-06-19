import { Injectable } from '@nestjs/common';
import type { ReportBarChart } from './report-chart.types';
import { escapeHtml } from './report.utils';

const CHART_WIDTH = 960;
const PLOT_HEIGHT = 280;
const MARGIN = { top: 35, right: 20, left: 65 };
const GRID_LINES = 5;
const CATEGORY_LINE_HEIGHT = 14;
const LEGEND_HEIGHT = 34;

@Injectable()
export class ReportChartService {
	buildGroupedBarChart(chart: ReportBarChart): string {
		if (chart.categories.length === 0 || chart.series.length === 0) {
			return `<div class="report-chart report-chart--empty">${escapeHtml(chart.emptyLabel ?? '—')}</div>`;
		}

		const values = chart.series.flatMap((series) => series.values.map((value) => safeValue(value)));
		const maximum = Math.max(1, ...values);
		const axisMaximum = this.roundAxisMaximum(maximum);
		const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
		const categoryLines = chart.categories.map((category) => wrapLabel(category, 20));
		const maximumCategoryLines = Math.max(...categoryLines.map((lines) => lines.length));
		const categoryHeight = maximumCategoryLines * CATEGORY_LINE_HEIGHT + 24;
		const chartHeight = MARGIN.top + PLOT_HEIGHT + categoryHeight + LEGEND_HEIGHT;
		const groupWidth = plotWidth / chart.categories.length;
		const groupPadding = Math.min(18, groupWidth * 0.18);
		const barGap = Math.min(5, groupWidth * 0.04);
		const barsWidth = Math.max(1, groupWidth - groupPadding * 2);
		const barWidth = Math.max(
			2,
			(barsWidth - barGap * Math.max(0, chart.series.length - 1)) / chart.series.length,
		);

		const grid = Array.from({ length: GRID_LINES + 1 }, (_, index) => {
			const value = (axisMaximum / GRID_LINES) * index;
			const y = MARGIN.top + PLOT_HEIGHT - (value / axisMaximum) * PLOT_HEIGHT;
			return `
				<line x1="${MARGIN.left}" y1="${y}" x2="${CHART_WIDTH - MARGIN.right}" y2="${y}" class="report-chart__grid" />
				<text x="${MARGIN.left - 10}" y="${y + 4}" class="report-chart__axis-label" text-anchor="end">${formatNumber(value)}</text>
			`;
		}).join('');

		const bars = chart.categories
			.map((category, categoryIndex) => {
				const groupX = MARGIN.left + categoryIndex * groupWidth;
				const categoryBars = chart.series
					.map((series, seriesIndex) => {
						const value = safeValue(series.values[categoryIndex]);
						const height = (value / axisMaximum) * PLOT_HEIGHT;
						const x = groupX + groupPadding + seriesIndex * (barWidth + barGap);
						const y = MARGIN.top + PLOT_HEIGHT - height;
						return `
							<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" fill="${escapeHtml(series.color)}" rx="1" />
							<text x="${x + barWidth / 2}" y="${Math.max(MARGIN.top + 10, y - 5)}" class="report-chart__value" text-anchor="middle">${formatNumber(value)}</text>
						`;
					})
					.join('');

				const labelX = groupX + groupWidth / 2;
				const labelY = MARGIN.top + PLOT_HEIGHT + 20;
				const label = categoryLines[categoryIndex]
					.map(
						(line, lineIndex) =>
							`<tspan x="${labelX}" dy="${lineIndex === 0 ? 0 : CATEGORY_LINE_HEIGHT}">${escapeHtml(line)}</tspan>`,
					)
					.join('');
				return `
					${categoryBars}
					<text x="${labelX}" y="${labelY}" class="report-chart__category" text-anchor="middle">${label}</text>
				`;
			})
			.join('');

		const legendItemWidth = plotWidth / chart.series.length;
		const legendY = chartHeight - 16;
		const legend = chart.series
			.map((series, index) => {
				const x = MARGIN.left + index * legendItemWidth;
				return `
					<rect x="${x}" y="${legendY - 10}" width="12" height="12" fill="${escapeHtml(series.color)}" />
					<text x="${x + 18}" y="${legendY}" class="report-chart__legend">${escapeHtml(series.label)}</text>
				`;
			})
			.join('');

		const title = chart.title
			? `<h4 class="report-chart__title">${escapeHtml(chart.title)}</h4>`
			: '';
		const yAxisLabel = chart.yAxisLabel
			? `<text transform="translate(16 ${MARGIN.top + PLOT_HEIGHT / 2}) rotate(-90)" class="report-chart__axis-title" text-anchor="middle">${escapeHtml(chart.yAxisLabel)}</text>`
			: '';

		return `
			<figure class="report-chart">
				${title}
				<svg viewBox="0 0 ${CHART_WIDTH} ${chartHeight}" role="img" aria-label="${escapeHtml(chart.title ?? '')}">
					${grid}
					${yAxisLabel}
					<line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${MARGIN.top + PLOT_HEIGHT}" class="report-chart__axis" />
					<line x1="${MARGIN.left}" y1="${MARGIN.top + PLOT_HEIGHT}" x2="${CHART_WIDTH - MARGIN.right}" y2="${MARGIN.top + PLOT_HEIGHT}" class="report-chart__axis" />
					${bars}
					${legend}
				</svg>
			</figure>
		`;
	}

	private roundAxisMaximum(maximum: number): number {
		const roughStep = maximum / GRID_LINES;
		const magnitude = 10 ** Math.floor(Math.log10(roughStep));
		const normalized = roughStep / magnitude;
		const step =
			normalized <= 1
				? magnitude
				: normalized <= 2
					? 2 * magnitude
					: normalized <= 5
						? 5 * magnitude
						: 10 * magnitude;
		return Math.ceil(maximum / step) * step;
	}
}

function safeValue(value: number | undefined): number {
	return Number.isFinite(value) && value !== undefined ? Math.max(0, value) : 0;
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function wrapLabel(value: string, maximumLineLength: number): string[] {
	const words = value.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [''];

	const lines: string[] = [];
	let current = '';

	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length <= maximumLineLength || current === '') {
			current = candidate;
			continue;
		}
		lines.push(current);
		current = word;
	}

	if (current) lines.push(current);
	return lines;
}
